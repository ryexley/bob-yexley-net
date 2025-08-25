export async function captureFormData({
  request,
  model,
  transform = data => data,
}) {
  const keys = Object.keys(model?.shape || {}) || []
  const requestFormData = await request.formData()
  const formData = {}

  for (const property of keys) {
    formData[property] = requestFormData.get(property)
  }

  try {
    const transformedData = transform(formData)
    const data = model.parse(transformedData)
    return { data, errors: [] }
  } catch (error) {
    const errors = Array.isArray(error?.issues) ? error?.issues?.reduce((errorsHash, e) => {
      errorsHash[e?.path[0]] = e?.message || "Unknown error"
      return errorsHash
    }, {}) : error

    return {
      data: formData,
      errors,
    }
  }
}
