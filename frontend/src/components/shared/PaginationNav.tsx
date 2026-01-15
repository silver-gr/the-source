import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaginationNavProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  maxVisiblePages?: number;
}

export function PaginationNav({
  currentPage,
  totalPages,
  onPageChange,
  maxVisiblePages = 7,
}: PaginationNavProps) {
  // Generate array of page numbers to display with ellipsis logic
  const getPageNumbers = (): (number | "ellipsis")[] => {
    if (totalPages <= maxVisiblePages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | "ellipsis")[] = [];
    const leftSiblingIndex = Math.max(currentPage - 1, 1);
    const rightSiblingIndex = Math.min(currentPage + 1, totalPages);

    const shouldShowLeftEllipsis = leftSiblingIndex > 2;
    const shouldShowRightEllipsis = rightSiblingIndex < totalPages - 1;

    // Always show first page
    pages.push(1);

    if (shouldShowLeftEllipsis) {
      pages.push("ellipsis");
    } else if (leftSiblingIndex === 2) {
      pages.push(2);
    }

    // Show pages around current page
    for (let i = leftSiblingIndex; i <= rightSiblingIndex; i++) {
      if (i !== 1 && i !== totalPages) {
        pages.push(i);
      }
    }

    if (shouldShowRightEllipsis) {
      pages.push("ellipsis");
    } else if (rightSiblingIndex === totalPages - 1) {
      pages.push(totalPages - 1);
    }

    // Always show last page
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className="flex items-center justify-center gap-1"
    >
      {/* First Page */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onPageChange(1)}
        disabled={currentPage === 1}
        aria-label="Go to first page"
        className={cn(
          "h-9 w-9 rounded-lg",
          "transition-all duration-200",
          "hover:bg-muted hover:scale-105",
          "disabled:opacity-30 disabled:hover:scale-100"
        )}
      >
        <ChevronsLeft className="h-4 w-4" />
      </Button>

      {/* Previous Page */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Go to previous page"
        className={cn(
          "h-9 w-9 rounded-lg",
          "transition-all duration-200",
          "hover:bg-muted hover:scale-105",
          "disabled:opacity-30 disabled:hover:scale-100"
        )}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* Page Numbers */}
      <div className="flex items-center gap-0.5 mx-1">
        {pageNumbers.map((page, index) => {
          if (page === "ellipsis") {
            return (
              <span
                key={`ellipsis-${index}`}
                className="flex h-9 w-9 items-center justify-center text-sm text-muted-foreground select-none"
                aria-hidden="true"
              >
                ···
              </span>
            );
          }

          const isActive = currentPage === page;

          return (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              aria-label={`Go to page ${page}`}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "h-9 min-w-9 px-2 rounded-lg font-mono text-sm font-medium",
                "transition-all duration-200",
                "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-105"
              )}
            >
              {page}
            </button>
          );
        })}
      </div>

      {/* Next Page */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Go to next page"
        className={cn(
          "h-9 w-9 rounded-lg",
          "transition-all duration-200",
          "hover:bg-muted hover:scale-105",
          "disabled:opacity-30 disabled:hover:scale-100"
        )}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {/* Last Page */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onPageChange(totalPages)}
        disabled={currentPage === totalPages}
        aria-label="Go to last page"
        className={cn(
          "h-9 w-9 rounded-lg",
          "transition-all duration-200",
          "hover:bg-muted hover:scale-105",
          "disabled:opacity-30 disabled:hover:scale-100"
        )}
      >
        <ChevronsRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}
