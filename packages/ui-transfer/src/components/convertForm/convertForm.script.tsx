import { useEffect, useMemo, useState } from "react";
import {
  useConfig,
  useConvert,
  useComputedLTV,
  useLocalStorage,
  useOdosQuote,
  useWalletConnector,
} from "@orderly.network/hooks";
import { useTranslation } from "@orderly.network/i18n";
import { account } from "@orderly.network/perp";
import { useAppContext } from "@orderly.network/react-app";
import type { NetworkId } from "@orderly.network/types";
import { toast } from "@orderly.network/ui";
import { Decimal } from "@orderly.network/utils";
import { useSettlePnl } from "../unsettlePnlInfo/useSettlePnl";
import { useToken } from "./hooks/useToken";

const { calcMinimumReceived } = account;

export type ConvertFormScriptReturn = ReturnType<typeof useConvertFormScript>;

const ORDERLY_CONVERT_SLIPPAGE_KEY = "orderly_convert_slippage";
const ODOS_QUOTE_DEBOUNCE_MS = 300;

export interface ConvertFormScriptOptions {
  token?: string;
  close?: () => void;
}

export const normalizeAmount = (amount: string, decimals: number) => {
  return new Decimal(amount).mul(new Decimal(10).pow(decimals)).toFixed(0);
};

export const unnormalizeAmount = (amount: string, decimals: number) => {
  return new Decimal(amount).div(new Decimal(10).pow(decimals)).toString();
};

export const useConvertFormScript = (options: ConvertFormScriptOptions) => {
  const { token: defaultToken, close } = options;

  const { t } = useTranslation();
  const [loading, setLoading] = useState<boolean>(false);

  const config = useConfig();

  const networkId = config.get("networkId") as NetworkId;

  const [quantity, setQuantity] = useState<string>("");

  const { wrongNetwork } = useAppContext();

  const { wallet } = useWalletConnector();

  const {
    sourceToken,
    sourceTokens,
    onSourceTokenChange,
    targetToken,
    targetChainInfo,
  } = useToken({ defaultValue: defaultToken });

  const { walletName, address } = useMemo(
    () => ({
      walletName: wallet?.label,
      address: wallet?.accounts?.[0].address,
    }),
    [wallet],
  );

  const onQuantityChange = (qty: string) => {
    setQuantity(qty);
  };

  const [slippage, setSlippage] = useLocalStorage(
    ORDERLY_CONVERT_SLIPPAGE_KEY,
    1,
  );

  const { maxAmount, convert } = useConvert({ token: sourceToken?.token });

  const onConvert = async () => {
    if (loading) {
      return;
    }
    setLoading(true);
    return convert({
      amount: Number(quantity),
      slippage: new Decimal(slippage).div(100).toNumber(),
    })
      .then(() => {
        toast.success(t("transfer.convert.completed"));
        close?.();
        setQuantity("");
      })
      .catch((err: Error) => {
        toast.error(
          err.message?.includes("user rejected")
            ? t("transfer.convert.failed")
            : err.message,
        );
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const [
    postQuote,
    { data: quoteData, reset: resetQuote, isMutating: isQuoteLoading },
  ] = useOdosQuote();

  const quoteRequest = useMemo(() => {
    const { quoteChainId, contract_address, decimals } = sourceToken || {};
    const targetAddress = targetChainInfo?.contract_address;

    if (
      !quantity ||
      new Decimal(quantity).lte(0) ||
      !quoteChainId ||
      !contract_address ||
      typeof decimals === "undefined" ||
      !targetAddress
    ) {
      return null;
    }

    const inputAmount = normalizeAmount(quantity, decimals);

    return {
      inputAmount,
      inputTokenAddress: contract_address.toLowerCase(),
      outputTokenAddress: targetAddress.toLowerCase(),
      body: {
        chainId: parseInt(quoteChainId),
        inputTokens: [
          {
            amount: inputAmount,
            tokenAddress: contract_address,
          },
        ],
        outputTokens: [
          {
            proportion: 1,
            tokenAddress: targetAddress,
          },
        ],
        // simple: true,
      },
    };
  }, [
    quantity,
    sourceToken?.quoteChainId,
    sourceToken?.contract_address,
    sourceToken?.decimals,
    targetChainInfo?.contract_address,
    targetChainInfo?.decimals,
  ]);

  useEffect(() => {
    resetQuote();

    if (!quoteRequest) {
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      // https://docs.odos.xyz/build/api-docs
      postQuote(quoteRequest.body).catch((error) => {
        if (!active) {
          return;
        }

        let message = t("transfer.convert.failed");

        if (error instanceof Error) {
          message = error.message;
        } else if (error) {
          message = String(error);
        }

        if (message === "Failed to fetch") {
          message = t("transfer.convert.quoteFailed");
        }

        console.error("[convertForm] Odos quote failed:", error);
        toast.error(message);
        resetQuote();
      });
    }, ODOS_QUOTE_DEBOUNCE_MS);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [postQuote, quoteRequest, resetQuote, t]);

  const isQuoteDataMatched = useMemo(() => {
    if (!quoteData || !quoteRequest) {
      return false;
    }

    const inAmount = quoteData?.inAmounts?.[0]?.toString();
    const inToken = quoteData?.inTokens?.[0]?.toLowerCase();
    const outToken = quoteData?.outTokens?.[0]?.toLowerCase();

    return (
      inAmount === quoteRequest.inputAmount &&
      inToken === quoteRequest.inputTokenAddress &&
      outToken === quoteRequest.outputTokenAddress
    );
  }, [quoteData, quoteRequest]);

  useEffect(() => {
    if (quoteData && !isQuoteDataMatched) {
      resetQuote();
    }
  }, [isQuoteDataMatched, quoteData, resetQuote]);

  const memoizedOutAmounts = useMemo<string>(() => {
    if (quoteData && !isQuoteLoading && isQuoteDataMatched) {
      return quoteData?.outAmounts[0];
    }

    return "-";
  }, [quoteData, isQuoteDataMatched, isQuoteLoading]);

  const memoizedConvertRate = useMemo(() => {
    if (quoteData && !isQuoteLoading && isQuoteDataMatched) {
      return new Decimal(
        unnormalizeAmount(
          quoteData.outAmounts[0],
          targetChainInfo?.decimals ?? 6,
        ),
      )
        .div(
          unnormalizeAmount(quoteData.inAmounts[0], sourceToken?.decimals ?? 6),
        )
        .toString();
    }

    return "-";
  }, [
    isQuoteDataMatched,
    isQuoteLoading,
    quoteData,
    sourceToken,
    targetChainInfo,
  ]);

  const memoizedMinimumReceived = useMemo(() => {
    if (!quoteData || isQuoteLoading || !isQuoteDataMatched) {
      return 0;
    }

    return calcMinimumReceived({
      amount: quoteData?.outAmounts[0],
      slippage: Number(slippage),
    });
  }, [quoteData, isQuoteDataMatched, isQuoteLoading, slippage]);

  const currentLtv = useComputedLTV();

  const nextLTV = useComputedLTV({
    input: Number(quantity),
    token: sourceToken?.token,
  });

  const disabled = !quantity || Number(quantity) === 0;

  const { hasPositions, onSettlePnl } = useSettlePnl();

  return {
    walletName,
    address,
    quantity,
    onQuantityChange,
    token: sourceToken,
    sourceTokens,
    onSourceTokenChange,
    targetToken,
    balanceRevalidating: false,
    maxQuantity: maxAmount,
    disabled,
    loading,
    wrongNetwork,
    onConvert,
    hasPositions,
    onSettlePnl,
    networkId,
    slippage,
    onSlippageChange: setSlippage,
    convertRate: memoizedConvertRate,
    minimumReceived: memoizedMinimumReceived,
    outAmounts: memoizedOutAmounts,
    isQuoteLoading,
    currentLTV: currentLtv,
    nextLTV: nextLTV,
    targetChainInfo,
  };
};
