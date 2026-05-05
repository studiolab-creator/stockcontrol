'use client'
import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Printer, Download } from 'lucide-react'

type Product = { id: string; nombre: string }

type QrManagementClientProps = {
  products: Product[]
}

export function QrManagementClient({ products }: QrManagementClientProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const allSelected = products.length > 0 && selected.size === products.length
  const noneSelected = selected.size === 0

  const selectedProducts = useMemo(
    () => products.filter((p) => selected.has(p.id)),
    [products, selected],
  )

  const toggleProduct = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(products.map((p) => p.id)))
    }
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h2 className="text-base font-semibold text-foreground mb-1">
          Sin productos activos
        </h2>
        <p className="text-sm text-muted-foreground">
          No hay productos activos para generar códigos QR.
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Screen-only UI — hidden during print (RESEARCH.md Pitfall 7: never hide <body>) */}
      <div className="print:hidden">
        <div className="flex items-center gap-3 mb-4">
          {/* "Select all" uses boolean checked (allSelected) — base-nova Checkbox has no
              indeterminate state (RESEARCH.md Pitfall 8 / github.com/shadcn-ui/ui/issues/9357) */}
          <input
            type="checkbox"
            id="select-all"
            checked={allSelected}
            onChange={toggleAll}
            className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
            aria-label="Seleccionar todos los productos"
          />
          <label htmlFor="select-all" className="text-sm text-muted-foreground cursor-pointer">
            Seleccionar todos ({products.length})
          </label>

          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => window.print()}
            disabled={noneSelected}
          >
            <Printer className="h-4 w-4 mr-2" aria-hidden="true" />
            Imprimir seleccionados ({selected.size})
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          {products.map((product) => (
            <div
              key={product.id}
              className="flex items-center justify-between gap-3 p-3 rounded-md border border-border hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <input
                  type="checkbox"
                  id={`product-${product.id}`}
                  checked={selected.has(product.id)}
                  onChange={() => toggleProduct(product.id)}
                  className="h-4 w-4 rounded border-input accent-primary shrink-0 cursor-pointer"
                  aria-label={`Seleccionar ${product.nombre}`}
                />
                <label
                  htmlFor={`product-${product.id}`}
                  className="text-sm font-medium text-foreground truncate cursor-pointer"
                >
                  {product.nombre}
                </label>
              </div>

              {/* Download link — plain anchor, no JS required.
                  Route Handler at /api/qr/{id} returns image/png with Content-Disposition: attachment.
                  The `download` attribute triggers browser save dialog. */}
              <a
                href={`/api/qr/${product.id}`}
                download={`qr-${product.nombre}.png`}
                className="shrink-0"
              >
                <Button variant="ghost" size="sm" tabIndex={-1}>
                  <Download className="h-4 w-4 mr-1" aria-hidden="true" />
                  PNG
                </Button>
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* Print-only QR grid — hidden on screen, shown during print.
          4 columns × 5 rows = 20 QR codes per A4 page (D-13).
          @page A4 rule is in globals.css (added in Plan 00). */}
      <div className="hidden print:block" id="print-target">
        <div className="grid grid-cols-4 gap-6">
          {(selectedProducts.length > 0 ? selectedProducts : products).map((product) => (
            <div
              key={product.id}
              className="flex flex-col items-center gap-1 break-inside-avoid"
            >
              {/* img src points to Route Handler — browser fetches PNG during print preview.
                  Route Handler uses Cache-Control: immutable so repeated prints are instant. */}
              <img
                src={`/api/qr/${product.id}`}
                alt={`QR de ${product.nombre}`}
                className="w-full"
              />
              <span className="text-xs text-center font-medium leading-tight">
                {product.nombre}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
