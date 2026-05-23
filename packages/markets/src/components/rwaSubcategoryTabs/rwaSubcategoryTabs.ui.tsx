import React, { useEffect, useMemo } from "react";
import {
  MarketsType,
  useLocalStorage,
  useMarkets,
  useRwaSymbolsInfoStore,
} from "@orderly.network/hooks";
import { useTranslation } from "@orderly.network/i18n";
import type { API } from "@orderly.network/types";
import { TabPanel, Tabs } from "@orderly.network/ui";

export type RwaSubcategory = "all" | "fx" | "hk" | "kr" | "cn";

type RwaSubcategoryConfig = {
  value: RwaSubcategory;
  title: string;
  marketSession?: API.RwaSymbol["market_session"];
};

const RWA_SUBCATEGORY_CONFIGS: RwaSubcategoryConfig[] = [
  // US_STOCK and US_STOCK_EXT intentionally remain available only under All.
  { value: "all", title: "All" },
  { value: "fx", title: "FX", marketSession: "FX" },
  { value: "hk", title: "HK", marketSession: "HK_STOCK" },
  { value: "kr", title: "KR", marketSession: "KR_STOCK" },
  { value: "cn", title: "CN", marketSession: "CN_STOCK" },
];

const RWA_SUBCATEGORY_SESSION_MAP = RWA_SUBCATEGORY_CONFIGS.reduce<
  Partial<Record<RwaSubcategory, API.RwaSymbol["market_session"]>>
>((acc, item) => {
  if (item.marketSession) {
    acc[item.value] = item.marketSession;
  }
  return acc;
}, {});

export function createRwaSubcategoryFilter(
  subcategory: RwaSubcategory,
  rwaSymbolsInfo?: Record<string, API.RwaSymbol>,
) {
  return (data: any[]) => {
    const targetSession = RWA_SUBCATEGORY_SESSION_MAP[subcategory];

    if (!targetSession) {
      return data;
    }

    return data.filter((item) => {
      const marketSession =
        item?.market_session ?? rwaSymbolsInfo?.[item?.symbol]?.market_session;
      return marketSession === targetSession;
    });
  };
}

export type RwaSubcategoryTabsProps = {
  storageKey: string;
  className?: string;
  classNames?: Record<string, string>;
  variant?: any;
  size?: any;
  showScrollIndicator?: boolean;
  renderPanel: (
    subcategory: RwaSubcategory,
    dataFilter: (data: any[]) => any[],
  ) => React.ReactNode;
};

export const RwaSubcategoryTabs: React.FC<RwaSubcategoryTabsProps> = (
  props,
) => {
  const {
    storageKey,
    className,
    classNames,
    variant = "contained",
    size = "sm",
    showScrollIndicator,
    renderPanel,
  } = props;
  const { t } = useTranslation();
  const [subcategory, setSubcategory] = useLocalStorage<RwaSubcategory>(
    storageKey,
    "all",
  );
  const rwaSymbolsInfo = useRwaSymbolsInfoStore();
  // TODO: Pass available market sessions from the parent list to avoid recalculating RWA markets here.
  const [rwaMarkets] = useMarkets(MarketsType.RWA);

  const visibleTabs = useMemo(() => {
    const sessions = new Set(
      rwaMarkets
        .map(
          (item) =>
            item.market_session ??
            rwaSymbolsInfo?.[item.symbol]?.market_session,
        )
        .filter(Boolean),
    );

    return RWA_SUBCATEGORY_CONFIGS.filter((tab) => {
      if (!tab.marketSession) {
        return true;
      }
      return sessions.has(tab.marketSession);
    });
  }, [rwaMarkets, rwaSymbolsInfo]);

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.value === subcategory)) {
      setSubcategory("all");
    }
  }, [subcategory, setSubcategory, visibleTabs]);

  return (
    <Tabs
      variant={variant}
      size={size}
      value={subcategory}
      onValueChange={(value) => setSubcategory(value as RwaSubcategory)}
      classNames={classNames as any}
      className={className}
      showScrollIndicator={showScrollIndicator}
    >
      {visibleTabs.map((tab) => (
        <TabPanel
          key={tab.value}
          title={tab.value === "all" ? t("common.all") : tab.title}
          value={tab.value}
        >
          {renderPanel(
            tab.value,
            createRwaSubcategoryFilter(tab.value, rwaSymbolsInfo),
          )}
        </TabPanel>
      ))}
    </Tabs>
  );
};
