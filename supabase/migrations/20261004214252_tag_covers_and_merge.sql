-- Add cover_image column to tags
ALTER TABLE public.tags ADD COLUMN cover_image TEXT;

COMMENT ON COLUMN public.tags.cover_image IS 'R2 storage key or absolute URL for tag cover image used in og:image';

-- RLS policies for tag cover images
-- Admins can update tags (including cover_image)
CREATE POLICY "Admins can update tags"
  ON public.tags
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('admin', 'superuser')
    )
  );

-- Public read access to tags
CREATE POLICY "Public read access to tags"
  ON public.tags
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Function to merge tags (admin-only)
CREATE OR REPLACE FUNCTION public.merge_tags(
  source_id UUID,
  target_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin BOOLEAN;
BEGIN
  -- Check if current user is admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.user_id = auth.uid()
    AND user_profiles.role IN ('admin', 'superuser')
  ) INTO is_admin;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Only admins can merge tags';
  END IF;

  -- Validate inputs
  IF source_id = target_id THEN
    RAISE EXCEPTION 'Source and target tags must be different';
  END IF;

  -- Move blip_tags from source to target (handle duplicates with ON CONFLICT)
  INSERT INTO public.blip_tags (blip_id, tag_id, created_at)
  SELECT blip_id, target_id, created_at
  FROM public.blip_tags
  WHERE tag_id = source_id
  ON CONFLICT (blip_id, tag_id) DO NOTHING;

  -- Update target tag with source data if target fields are null
  UPDATE public.tags
  SET
    description = COALESCE(tags.description, (SELECT description FROM public.tags WHERE id = source_id)),
    cover_image = COALESCE(tags.cover_image, (SELECT cover_image FROM public.tags WHERE id = source_id))
  WHERE id = target_id;

  -- Delete source tag's blip_tags associations
  DELETE FROM public.blip_tags WHERE tag_id = source_id;

  -- Delete source tag
  DELETE FROM public.tags WHERE id = source_id;
END;
$$;

COMMENT ON FUNCTION public.merge_tags IS 'Merge source tag into target tag, moving all blip associations (admin-only)';
