interface ISelectOption {
  value: string;
  label: string;
  /** Identidade visual opcional (ver `formatCategoryOption`). */
  icon?: string | null;
  color?: string | null;
}

export default ISelectOption;
