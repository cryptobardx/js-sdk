import useSWRMutation from "swr/mutation";
import { useMemoizedFn } from "../shared/useMemoizedFn";

const ODOS_QUOTE_URL = "https://enterprise-api.odos.xyz/sor/quote/v3";
const ODOS_API_KEY = "7593d67b-93ac-4432-8b9f-ce8251ae4912";

const fetchOdosQuote = async (
  url: string,
  options: {
    arg: Record<string, any> | null;
  },
) => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ODOS_API_KEY,
    },
    body: JSON.stringify(options.arg),
  });

  const responseText = await response.text();
  let data: any = null;

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      data = responseText;
    }
  }

  if (!response.ok) {
    const errorMessage =
      typeof data === "object" && data !== null
        ? data?.detail || data?.message || data?.code
        : data;

    throw new Error(
      errorMessage ||
        response.statusText ||
        `Request failed: ${response.status}`,
    );
  }

  return data;
};

export const useOdosQuote = () => {
  const { trigger, data, error, reset, isMutating } = useSWRMutation(
    ODOS_QUOTE_URL,
    fetchOdosQuote,
  );

  const postQuote = (data: Record<string, any> | null) => {
    return trigger(data);
  };

  return [
    useMemoizedFn(postQuote),
    { data, error, reset, isMutating },
  ] as const;
};
