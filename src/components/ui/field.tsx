"use client";

import { type ReactNode } from "react";

import { cva, type VariantProps } from "class-variance-authority";
import {
  FieldError as AriaFieldError,
  FieldErrorProps as AriaFieldErrorProps,
  Group as AriaGroup,
  GroupProps as AriaGroupProps,
  Label as AriaLabel,
  LabelProps as AriaLabelProps,
  Text as AriaText,
  TextProps as AriaTextProps,
  composeRenderProps
} from "react-aria-components";

import { cn } from "@/lib/utils";

const labelVariants = cva([
  "text-sm font-medium leading-none",
  "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-70",
  "group-data-[invalid]:text-destructive"
]);

type LabelProps = AriaLabelProps & { className?: string; children?: ReactNode };

const Label = ({ className, ...props }: LabelProps) => (
  <AriaLabel className={cn(labelVariants(), className)} {...props} />
);

type DescriptionProps = AriaTextProps & { className?: string };

function FormDescription({ className, ...props }: DescriptionProps) {
  return (
    <AriaText
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
      slot="description"
    />
  );
}

type FieldErrorProps = AriaFieldErrorProps & { className?: string };

function FieldError({ className, ...props }: FieldErrorProps) {
  return (
    <AriaFieldError
      className={cn("text-sm font-medium text-destructive", className)}
      {...props}
    />
  );
}

const fieldGroupVariants = cva("", {
  variants: {
    variant: {
      default: [
        "relative flex h-10 w-full items-center overflow-hidden rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
        "data-[focus-within]:outline-none data-[focus-within]:ring-2 data-[focus-within]:ring-ring data-[focus-within]:ring-offset-2",
        "data-[disabled]:opacity-50"
      ],
      ghost: ""
    }
  },
  defaultVariants: {
    variant: "default"
  }
});

type GroupProps = AriaGroupProps &
  VariantProps<typeof fieldGroupVariants> & { className?: string };

function FieldGroup({ className, variant, ...props }: GroupProps) {
  return (
    <AriaGroup
      className={composeRenderProps(className, (className) =>
        cn(fieldGroupVariants({ variant }), className)
      )}
      {...props}
    />
  );
}

export {
  Label,
  labelVariants,
  FieldGroup,
  fieldGroupVariants,
  FieldError,
  FormDescription
};
