import { put } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const saleId = formData.get('saleId') as string

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })
    }

    if (!saleId) {
      return NextResponse.json({ error: 'No se proporcionó ID de venta' }, { status: 400 })
    }

    // Validate file type (only images)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de archivo no permitido. Solo se permiten imágenes (JPG, PNG, WebP, HEIC)' },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'El archivo es demasiado grande. Máximo 10MB' },
        { status: 400 }
      )
    }

    // Upload to Vercel Blob (private store)
    const blob = await put(`receipts/${saleId}/${file.name}`, file, {
      access: 'private',
    })

    // Update the sale with the receipt URL
    const supabase = await createClient()
    const { error: updateError } = await supabase
      .from('sales')
      .update({
        receipt_image_url: blob.pathname,
        receipt_uploaded_at: new Date().toISOString(),
      })
      .eq('id', saleId)

    if (updateError) {
      console.error('Error updating sale:', updateError)
      return NextResponse.json({ error: 'Error al actualizar la venta' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      pathname: blob.pathname,
      message: 'Comprobante subido exitosamente' 
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Error al subir el archivo' }, { status: 500 })
  }
}
