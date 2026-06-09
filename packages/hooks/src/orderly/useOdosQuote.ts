import { useMemo } from "react";
import { useMemoizedFn } from "../shared/useMemoizedFn";
import { useMutation } from "../useMutation";

const ODOS_QUOTE_URL = "/v1/odos/quote";

const unwrapOdosQuoteResponse = (response: any) => {
  if (response && typeof response === "object" && "success" in response) {
    return response.success === false ? undefined : response.data;
  }

  return response;
};

const normalizeOdosQuoteResponse = (response: any) => {
  if (response && typeof response === "object" && "success" in response) {
    if (response.success === false) {
      throw new Error(response.message || response.code || "Quote failed");
    }
  }

  return unwrapOdosQuoteResponse(response);
};

export const useOdosQuote = () => {
  const [trigger, { data, error, reset, isMutating }] =
    useMutation(ODOS_QUOTE_URL);

  const postQuote = (data: Record<string, any> | null) => {
    return trigger(data).then(normalizeOdosQuoteResponse);
  };

  const quoteData = useMemo(() => unwrapOdosQuoteResponse(data), [data]);

  return [
    useMemoizedFn(postQuote),
    { data: quoteData, error, reset, isMutating },
  ] as const;
};
