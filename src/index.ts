require("dotenv").config();

import { ChainInfo } from "@keplr-wallet/types";
import { Dec } from "@keplr-wallet/unit";

const REPOSITORY = "chainapsis/keplr-chain-registry";
const CHAIN_NAME = "osmosis";
const BASE_FEE_ENDPOINT = "https://lcd-osmosis.keplr.app";

(async () => {
  while(true) {
    try {
      if (!process.env.GITHUB_TOKEN) {
        console.error(
          "There is no GITHUB_TOKEN, Please set it first on .env file",
        );
        return;
      }

      const chainInfoResponse = await fetch(
        `https://api.github.com/repos/${REPOSITORY}/contents/cosmos/${CHAIN_NAME}.json`,
        {
          headers: {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
            Accept: "application/vnd.github.v3+json",
          },
        },
      );
      const chainInfoResult = await chainInfoResponse.json();
      const content = Buffer.from(chainInfoResult.content, "base64").toString();
      const chainInfo: ChainInfo = JSON.parse(content);

      // Get Osmosis's gas price step.
      const gasPriceStep = chainInfo.feeCurrencies.find(
        (currency) => currency.coinMinimalDenom === "uosmo",
      )?.gasPriceStep;

      if (gasPriceStep) {
        // Get Osmosis's base fee.
        const baseFeeResponse = await fetch(
          `${BASE_FEE_ENDPOINT}/osmosis/txfees/v1beta1/cur_eip_base_fee`,
        );
        const baseFeeResult: { base_fee: string } = await baseFeeResponse.json();
        const baseFee = new Dec(baseFeeResult.base_fee);

        // Calculate new gas price step.
        const low = new Dec(gasPriceStep.low);
        let average = baseFee.mul(new Dec(1.1));
        let high = baseFee.mul(new Dec(2));

        if (average.lt(low)) {
          average = low;
        }

        if (high.lt(average)) {
          high = average;
        }

        // If the gas price step is not changed, do not update.
        if (
          gasPriceStep.average === parseFloat(average.toString()) &&
          gasPriceStep.high === parseFloat(high.toString())
        ) {
          console.error("No need to update");
          return;
        }

        const newGasPriceStep = {
          ...gasPriceStep,
          average: parseFloat(average.toString()),
          high: parseFloat(high.toString()),
        };

        // Update the gas price step.
        const newChainInfo = {
          ...chainInfo,
          feeCurrencies: chainInfo.feeCurrencies.map((currency) => {
            if (currency.coinMinimalDenom === "uosmo") {
              return {
                ...currency,
                gasPriceStep: newGasPriceStep,
              };
            }
            return currency;
          }),
        };

        const message = {
          message: `Update ${CHAIN_NAME}'s gas price step`,
          content: Buffer.from(JSON.stringify(newChainInfo, null, 2)).toString(
            "base64",
          ),
          sha: chainInfoResult.sha,
        };

        await fetch(
          `https://api.github.com/repos/${REPOSITORY}/contents/cosmos/${CHAIN_NAME}.json`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
              Accept: "application/vnd.github.v3+json",
            },
            body: JSON.stringify(message),
          },
        );
      }

    } catch (e: any) {
      console.log(e.message || e.toString());
    }

    // 2 minutes
    await new Promise((r) => setTimeout(r, 1000 * 60 * 2 ));
  }
})();
