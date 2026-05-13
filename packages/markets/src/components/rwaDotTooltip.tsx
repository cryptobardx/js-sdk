import { isCurrentlyTrading } from "@orderly.network/hooks";
import { useTranslation } from "@orderly.network/i18n";
import { Text, Tooltip, Box } from "@orderly.network/ui";

export type RwaDotTooltipProps = {
  record: any;
};

export const RwaDotTooltip = ({ record }: RwaDotTooltipProps) => {
  const { t } = useTranslation();

  const isInTradingHours = isCurrentlyTrading(
    record.rwaNextClose,
    record.rwaStatus,
  );

  if (!record.isRwa) {
    return null;
  }

  return (
    <Tooltip
      className="oui-pointer-events-none"
      disableHoverableContent
      content={
        <Text color={isInTradingHours ? "success" : "danger"}>
          {isInTradingHours
            ? t("trading.rwa.marketHours")
            : t("trading.rwa.outsideMarketHours")}
        </Text>
      }
    >
      <Box
        as="span"
        py={2}
        px={1}
        className="oui-inline-flex oui-shrink-0 oui-items-center"
      >
        <Box
          as="span"
          width={4}
          height={4}
          r="full"
          className={isInTradingHours ? "oui-bg-success" : "oui-bg-danger"}
        />
      </Box>
    </Tooltip>
  );
};
