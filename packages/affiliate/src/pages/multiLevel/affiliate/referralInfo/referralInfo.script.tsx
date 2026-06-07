import { useMemo } from "react";
import { modal } from "@orderly.network/ui";
import { Decimal } from "@orderly.network/utils";
import { useReferralContext } from "../../../../provider";
import { ReferralCodeFormField, ReferralCodeFormType } from "../../../../types";
import { generateReferralLink } from "../../../../utils/utils";
import { ReferralCodeFormDialogId } from "../referralCodeForm/modal";

export type ReferralInfoReturns = ReturnType<typeof useReferralInfoScript>;

export const useReferralInfoScript = () => {
  const {
    referralLinkUrl,
    multiLevelRebateInfo,
    multiLevelRebateInfoMutate,
    maxRebateRate,
  } = useReferralContext();

  const referralCode = multiLevelRebateInfo?.referral_code;

  const referralLink = useMemo(() => {
    if (!referralCode) return "";

    return generateReferralLink(referralLinkUrl, referralCode);
  }, [referralCode]);

  const directTradesRate = useMemo(() => {
    return new Decimal(multiLevelRebateInfo?.bonus_max_rebate_rate ?? 0)
      .add(multiLevelRebateInfo?.base_rebate_rate ?? 0)
      .mul(100)
      .toNumber();
  }, [multiLevelRebateInfo]);

  const indirectTradesRate = useMemo(() => {
    return new Decimal(multiLevelRebateInfo?.bonus_max_rebate_rate ?? 0)
      .sub(multiLevelRebateInfo?.default_bonus_referee_rebate_rate ?? 0)
      .mul(100)
      .toNumber();
  }, [multiLevelRebateInfo]);

  const showIndirectTrades = useMemo(() => {
    return !new Decimal(multiLevelRebateInfo?.bonus_max_rebate_rate ?? 0).eq(0);
  }, [multiLevelRebateInfo]);

  const directBonusRebateRate = useMemo(() => {
    return new Decimal(multiLevelRebateInfo?.direct_bonus_rebate_rate ?? 0)
      .mul(100)
      .toNumber();
  }, [multiLevelRebateInfo]);

  const onEdit = (focusField?: ReferralCodeFormField) => {
    modal.show(ReferralCodeFormDialogId, {
      type: ReferralCodeFormType.Edit,
      focusField,
      referralCode: multiLevelRebateInfo?.referral_code,
      maxRebateRate,
      referrerRebateRate: multiLevelRebateInfo?.referrer_rebate_rate,
      directInvites: multiLevelRebateInfo?.direct_invites,
      directBonusRebateRate,
      onSuccess: () => {
        multiLevelRebateInfoMutate();
      },
    });
  };

  return {
    onEdit,
    referralCode,
    referralLink,
    multiLevelRebateInfo,
    directTradesRate,
    indirectTradesRate,
    showIndirectTrades,
    directBonusRebateRate,
  };
};
