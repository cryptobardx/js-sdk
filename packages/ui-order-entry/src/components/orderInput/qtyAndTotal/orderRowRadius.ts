import { cn } from "@orderly.network/ui";

/**
 * First grid column (quantity): logical corners that auto-flip in RTL.
 *
 * @param hasStackedRowAbove `true` when price/trigger sits above — small physical-top seam.
 */
export function quantityOrderRowRoundedCn(hasStackedRowAbove: boolean) {
  return cn(
    hasStackedRowAbove && "!oui-rounded-t",
    !hasStackedRowAbove && "!oui-rounded-ss-xl !oui-rounded-se",
    "!oui-rounded-es-xl !oui-rounded-ee",
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
    !hasStackedRowAbove && "!oui-rounded-se-xl !oui-rounded-ss",
    "!oui-rounded-es !oui-rounded-ee-xl",
  );
}
