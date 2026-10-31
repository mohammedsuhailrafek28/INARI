import { Button } from "@/components/ui/button";
import { formatTitle } from "@/lib/formatters";

export type RecommendationSort = "priority" | "confidenceHigh" | "confidenceLow" | "category";

export type RecommendationFiltersProps = {
  categories: string[];
  risks: string[];
  selectedCategory: string;
  selectedRisk: string;
  sort: RecommendationSort;
  onCategoryChange: (category: string) => void;
  onRiskChange: (risk: string) => void;
  onSortChange: (sort: RecommendationSort) => void;
  onReset: () => void;
};

export function RecommendationFilters({
  categories,
  risks,
  selectedCategory,
  selectedRisk,
  sort,
  onCategoryChange,
  onRiskChange,
  onSortChange,
  onReset,
}: RecommendationFiltersProps) {
  return (
    <section className="rounded-[var(--wv-radius-card)] border border-wv-border bg-wv-surface p-5 shadow-wv-card">
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
        <FilterSelect
          label="Category"
          value={selectedCategory}
          onChange={onCategoryChange}
          options={["all", ...categories]}
        />
        <FilterSelect
          label="Risk level"
          value={selectedRisk}
          onChange={onRiskChange}
          options={["all", ...risks]}
        />
        <label className="block">
          <span className="text-sm font-semibold text-wv-text">Sort by</span>
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value as RecommendationSort)}
            className="mt-2 min-h-11 w-full rounded-[var(--wv-radius-form)] border border-wv-border bg-wv-surface px-3 text-sm font-semibold text-wv-text outline-none focus-visible:ring-2 focus-visible:ring-wv-primary focus-visible:ring-offset-2"
          >
            <option value="priority">Priority</option>
            <option value="confidenceHigh">Highest confidence</option>
            <option value="confidenceLow">Lowest confidence</option>
            <option value="category">Category</option>
          </select>
        </label>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 border-wv-border text-wv-text"
          onClick={onReset}
        >
          Reset
        </Button>
      </div>
    </section>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-wv-text">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-11 w-full rounded-[var(--wv-radius-form)] border border-wv-border bg-wv-surface px-3 text-sm font-semibold text-wv-text outline-none focus-visible:ring-2 focus-visible:ring-wv-primary focus-visible:ring-offset-2"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option === "all" ? "All" : formatTitle(option)}
          </option>
        ))}
      </select>
    </label>
  );
}
