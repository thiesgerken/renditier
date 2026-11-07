import { useState } from 'react';
import {
  createPaginatedRowModel,
  createSortedRowModel,
  flexRender,
  metaHelper,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import type {
  ColumnDef,
  PaginationState,
  Row,
  RowData,
  SortingState,
  Updater,
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Button } from './ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';

interface DataTableColumnMeta {
  // Shown next to the header from `md` up; phones get the plain label.
  icon?: LucideIcon;
  // The breakpoint from which the column shows; narrower screens only have
  // room for the essential ones.
  showFrom?: 'sm' | 'md' | 'xl';
}

// Spelled out, so that Tailwind finds the class names.
const SHOW_FROM = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  xl: 'hidden xl:table-cell',
};

const visibility = (meta: DataTableColumnMeta | undefined) =>
  meta?.showFrom === undefined ? undefined : SHOW_FROM[meta.showFrom];

export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  columnMeta: metaHelper<DataTableColumnMeta>(),
});

type Features = typeof dataTableFeatures;

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZES = [DEFAULT_PAGE_SIZE, 25, 50];

const collator = new Intl.Collator('de', { numeric: true });

// Strings by German collation with numbers in them compared by value ("Depot 2"
// before "Depot 10"), numbers numerically, missing values first. The DataGrid
// compared strings with the browser's default collation.
function compareValues<T extends RowData>(
  a: Row<Features, T>,
  b: Row<Features, T>,
  columnId: string
): number {
  const x = a.getValue(columnId);
  const y = b.getValue(columnId);
  if (x === null || x === undefined)
    return y === null || y === undefined ? 0 : -1;
  if (y === null || y === undefined) return 1;
  if (typeof x === 'number' && typeof y === 'number') return x - y;
  if (typeof x === 'string' && typeof y === 'string')
    return collator.compare(x, y);
  throw new Error(`column ${columnId} cannot be sorted by its values`);
}

interface Props<T extends RowData> {
  data: T[];
  // Each column keeps its own value type, so the list can only be typed loosely;
  // build it with `createColumnHelper<typeof dataTableFeatures, T>().columns`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<Features, T, any>[];
  getRowId: (row: T) => string;
  initialSorting: SortingState;
  isLoading: boolean;
  emptyText: string;
  // Without it, the table shows all rows on one page.
  pagination?: { page: number; onPageChange: (page: number) => void };
  onRowClick: (row: T) => void;
}

function DataTable<T extends RowData>({
  data,
  columns,
  getRowId,
  initialSorting,
  isLoading,
  emptyText,
  pagination: paging,
  onRowClick,
}: Props<T>) {
  const [sorting, setSorting] = useState(initialSorting);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  // A page beyond the data (a stale `?page=` or the last row of the last page
  // deleted) shows the last page instead of an empty one.
  const pageCount = Math.max(1, Math.ceil(data.length / pageSize));
  const pageIndex = Math.min(paging?.page ?? 0, pageCount - 1);
  const pagination = { pageIndex, pageSize };

  const onPaginationChange = (updater: Updater<PaginationState>) => {
    const next = typeof updater === 'function' ? updater(pagination) : updater;
    setPageSize(next.pageSize);
    if (next.pageIndex !== pageIndex) paging?.onPageChange(next.pageIndex);
  };

  const table = useTable({
    features: dataTableFeatures,
    data,
    columns,
    getRowId,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange,
    defaultColumn: { sortFn: compareValues },
    // Like the DataGrid: one column at a time, ascending first.
    enableMultiSort: false,
    sortDescFirst: false,
    // The page lives in the URL and must survive a reload (data arriving after
    // the first render), a refetch after a change, and a new sort order.
    autoResetPageIndex: false,
  });

  const rowCount = table.getPrePaginatedRowModel().rows.length;
  const firstRow = rowCount === 0 ? 0 : pageIndex * pageSize + 1;
  const lastRow = Math.min(rowCount, (pageIndex + 1) * pageSize);
  const rows =
    paging === undefined
      ? table.getPrePaginatedRowModel().rows
      : table.getRowModel().rows;

  const openRow = (row: Row<Features, T>) => onRowClick(row.original);

  return (
    <div aria-busy={isLoading}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map(header => {
                const Icon = header.column.columnDef.meta?.icon;
                const sorted = header.column.getIsSorted();
                const SortIcon =
                  sorted === 'asc'
                    ? ArrowUp
                    : sorted === 'desc'
                      ? ArrowDown
                      : null;

                return (
                  <TableHead
                    key={header.id}
                    className={visibility(header.column.columnDef.meta)}
                    aria-sort={
                      sorted === 'asc'
                        ? 'ascending'
                        : sorted === 'desc'
                          ? 'descending'
                          : undefined
                    }
                  >
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 font-medium disabled:cursor-default"
                      disabled={!header.column.getCanSort()}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {Icon && (
                        <Icon
                          aria-hidden
                          className="hidden size-4 text-muted-foreground md:inline"
                        />
                      )}
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {SortIcon && (
                        <SortIcon aria-hidden className="size-3.5" />
                      )}
                    </button>
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.map(row => (
            <TableRow
              key={row.id}
              tabIndex={0}
              className="cursor-pointer"
              onClick={() => openRow(row)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openRow(row);
                }
              }}
            >
              {row.getAllCells().map(cell => (
                <TableCell
                  key={cell.id}
                  className={visibility(cell.column.columnDef.meta)}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                {isLoading ? (
                  <LoaderCircle
                    aria-label="Wird geladen"
                    className="mx-auto size-5 animate-spin"
                  />
                ) : (
                  emptyText
                )}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {paging !== undefined && (
        <div className="flex items-center justify-end gap-4 border-t px-2 pt-2 text-sm text-muted-foreground">
          <div className="hidden items-center gap-2 md:flex">
            <span>Zeilen pro Seite</span>
            <Select
              value={String(pageSize)}
              onValueChange={value => table.setPageSize(Number(value))}
            >
              <SelectTrigger size="sm" aria-label="Zeilen pro Seite">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map(size => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="tabular-nums">
            {firstRow}–{lastRow} von {rowCount}
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Vorherige Seite"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Nächste Seite"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;
