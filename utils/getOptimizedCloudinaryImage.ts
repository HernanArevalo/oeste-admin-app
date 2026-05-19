export const getOptimizedCloudinaryImage = (
  url: string,
  width = 400
) => {
  return url.replace(
    '/upload/',
    `/upload/w_${width},q_auto,f_auto/`
  )
}