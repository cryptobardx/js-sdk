import { cn } from "@orderly.network/ui";

/**
 * First grid column (quantity): physical corners + `rtl:` overrides (logical corners mis-map when the input resolves `direction: ltr`).
 *
 * **Note:** Default classes assume left-column LTR physics; Tailwind `ltr:` needs an explicit `dir="ltr"` ancestor and is avoided here for `html[dir="rtl"]` apps.
 *
 * @param hasStackedRowAbove `true` when price/trigger sits above — small physical-top seam.
 */
export function quantityOrderRowRoundedCn(hasStackedRowAbove: boolean) {
  return cn(
    hasStackedRowAbove && "!oui-rounded-t",
    !hasStackedRowAbove &&
      cn(
        "!oui-rounded-tl-xl !oui-rounded-tr",
        "rtl:!oui-rounded-tr-xl rtl:!oui-rounded-tl",
      ),
    "!oui-rounded-bl-xl !oui-rounded-br",
    "rtl:!oui-rounded-bl rtl:!oui-rounded-br-xl",
  );
}

/**
 * Second grid column (total / margin): mirrors {@link quantityOrderRowRoundedCn}.
 *
 * @param hasStackedRowAbove `true` when price/trigger sits above — small physical-top seam.
 */
export function totalOrderRowRoundedCn(hasStackedRowAbove: boolean) {
  return cn(
    hasStackedRowAbove && "!oui-rounded-t",
    !hasStackedRowAbove &&
      cn(
        "!oui-rounded-tr-xl !oui-rounded-tl",
        "rtl:!oui-rounded-tl-xl rtl:!oui-rounded-tr",
      ),
    "!oui-rounded-bl !oui-rounded-br-xl",
    "rtl:!oui-rounded-bl-xl rtl:!oui-rounded-br",
  );
}
