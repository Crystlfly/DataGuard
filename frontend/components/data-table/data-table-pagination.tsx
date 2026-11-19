"use client"

import type { Table } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"

export function DataTablePagination<TData>({ table }: { table: Table<TData> }) {
  return (
    <div className="flex flex-col gap-3 border-t border-white/[0.08] px-4 py-3 text-sm text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {table.getFilteredRowModel().rows.length} row(s), page {table.getState().pagination.pageIndex + 1} of{" "}
        {table.getPageCount() || 1}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          className="border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08] hover:text-white"
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          className="border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08] hover:text-white"
        >
          Next
        </Button>
      </div>
    </div>
  )
}

