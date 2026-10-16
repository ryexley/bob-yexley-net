-- The reader now treats an omitted lightbox flag as on. These two stills were
-- posted without the flag on purpose and should stay inline-only. The night
-- photo on the second blip already has lightbox:true and is left alone.
-- replace() is a no-op when the exact embed is gone or already opted out.

update public.blips
set content = replace(
  content,
  '{media:{key:"media/f4e01a2c-f284-4bb0-b7f4-65d4b3400ddb/20261015230256611/sc-20261015230305",type:"image",mime:"image/png"}}',
  '{media:{key:"media/f4e01a2c-f284-4bb0-b7f4-65d4b3400ddb/20261015230256611/sc-20261015230305",type:"image",mime:"image/png",lightbox:false}}'
)
where id = '20261015230256611';

update public.blips
set content = replace(
  content,
  '{media:{key:"media/f4e01a2c-f284-4bb0-b7f4-65d4b3400ddb/20261015203533607/sc-20261015203553",type:"image",mime:"image/png"}}',
  '{media:{key:"media/f4e01a2c-f284-4bb0-b7f4-65d4b3400ddb/20261015203533607/sc-20261015203553",type:"image",mime:"image/png",lightbox:false}}'
)
where id = '20261015203533607';
