export const getOptimizedCloudinaryImage = (url: string, width = 400) => {
  return url.replace('/upload/', `/upload/w_${width},c_limit,q_auto,f_auto,dpr_auto/`)
}

export const getProductTableImage = (url: string) =>
  url.replace(
    '/upload/',
    '/upload/w_54,c_limit,q_auto,f_auto,dpr_auto/'
  )

export const getProductCardImage = (url: string) =>
  url.replace(
    '/upload/',
    '/upload/w_400,c_limit,q_auto,f_auto,dpr_auto/'
  )