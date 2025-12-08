import { SearchIcon, XIcon } from "lucide-react";

import { FieldGroup, Label } from "@/components/ui/field";
import {
  SearchField,
  SearchFieldClear,
  SearchFieldInput
} from "@/components/ui/searchfield";

export function SearchFieldDemo() {
  return (
    <SearchField className="max-w-[200px]">
      <Label>Search</Label>
      <FieldGroup>
        <SearchIcon aria-hidden className="size-4 text-muted-foreground" />
        <SearchFieldInput placeholder="Search..." />
        <SearchFieldClear>
          <XIcon aria-hidden className="size-4" />
        </SearchFieldClear>
      </FieldGroup>
    </SearchField>
  );
}
