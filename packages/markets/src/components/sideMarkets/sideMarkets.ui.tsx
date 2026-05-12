import React from "react";
import { Box, cn } from "@orderly.network/ui";
import { ExpandMarketsWidget } from "../expandMarkets";
import { MarketsListWidget } from "../marketsList";
import { useMarketsContext } from "../marketsProvider";
import { useFavoritesProps } from "../shared/hooks/useFavoritesExtraProps";
import type { SideMarketsScriptReturn } from "./sideMarkets.script";

export type SideMarketsProps = SideMarketsScriptReturn & {
  className?: string;
} & { panelSize?: "small" | "middle" | "large" };

export const SideMarkets: React.FC<SideMarketsProps> = (props) => {
  const { activeTab, onTabChange, className, tabSort, panelSize } = props;

  const { symbol, onSymbolChange } = useMarketsContext();

  const { getFavoritesProps } = useFavoritesProps();

  const renderContent = () => {
    if (panelSize === "large") {
      return (
        <ExpandMarketsWidget
          activeTab={activeTab}
          onTabChange={onTabChange}
          symbol={symbol}
          onSymbolChange={onSymbolChange}
        />
      );
    }
    return (
      <MarketsListWidget
        type={activeTab}
        initialSort={tabSort[activeTab]}
        panelSize={"middle"}
        {...getFavoritesProps(activeTab)}
      />
    );
  };

  // Parent trading column uses flex-1/min-h-0; avoid nested calc heights that double-subtract.
  return (
    <Box
      width="100%"
      height="100%"
      className={cn(className, "oui-min-h-0 oui-min-w-0 oui-max-w-full")}
    >
      {renderContent()}
    </Box>
  );

  // return (
  //   <Flex
  //     id="oui-side-markets"
  //     className={cn("oui-relative oui-font-semibold", className)}
  //     direction="column"
  //     gapY={5}
  //     height="100%"
  //     width="100%"
  //   >
  //     <Box width="100%" height="100%">
  //       {renderContent()}
  //     </Box>
  //   </Flex>
  // );
};
