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
}

export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  columnMeta: metaHelper<DataTableColumnMeta>(),
});

type Features = typeof dataTableFeatures;

const PAGE_SIZES = [10, 25, 50];

const collator = new Intl.Collator('de', { numeric: true });

// Strings by German collation, numbers numerically, missing values first: the
// order the MUI DataGrid used.
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
  return collator.compare(String(x), String(y));
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
  page: number;
  onPageChange: (page: number) => void;
  onRowClick: (row: T) => void;
}

function DataTable<T extends RowData>({
  data,
  columns,
  getRowId,
  initialSorting,
  isLoading,
  emptyText,
  page,
  onPageChange,
  onRowClick,
}: Props<T>) {
  const [sorting, setSorting] = useState(initialSorting);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const pagination = { pageIndex: page, pageSize };

  const onPaginationChange = (updater: Updater<PaginationState>) => {
    const next = typeof updater === 'function' ? updater(pagination) : updater;
    setPageSize(next.pageSize);
    if (next.pageIndex !== page) onPageChange(next.pageIndex);
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
    // Like the DataGrid: every column sorts ascending first.
    sortDescFirst: false,
  });

  const rowCount = table.getPrePaginatedRowModel().rows.length;
  const firstRow = rowCount === 0 ? 0 : page * pageSize + 1;
  const lastRow = Math.min(rowCount, (page + 1) * pageSize);
  const rows = table.getRowModel().rows;

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
                <TableCell key={cell.id}>
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
    </div>
  );
}

export default DataTable;
