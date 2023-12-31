require("dotenv").config();

import { ChainInfo } from "@keplr-wallet/types";
import { Dec } from "@keplr-wallet/unit";

const REPOSITORY = "chainapsis/keplr-chain-registry";
const CHAIN_NAME = "osmosis";
const BASE_FEE_ENDPOINT = "https://lcd-osmosis.keplr.app";

(async () => {
  while (true) {
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
        const baseFeeResult: { base_fee: string } =
          await baseFeeResponse.json();
        const baseFee = new Dec(baseFeeResult.base_fee);

        let newGasPriceStep: {
          low: number;
          average: number;
          high: number;
        };

        if (baseFee.gte(new Dec(0.025))) {
          // Calculate new gas price step.
          const low = new Dec(gasPriceStep.low);
          let average = baseFee.mul(new Dec(1.2));
          let high = baseFee.mul(new Dec(1.5));

          if (average.lt(low)) {
            average = low;
          }

          if (high.lt(average)) {
            high = average;
          }

          newGasPriceStep = {
            ...gasPriceStep,
            average: parseFloat(average.toString()),
            high: parseFloat(high.toString()),
          };
        } else {
          newGasPriceStep = {
            low: 0.0025,
            average: 0.025,
            high: 0.04,
          };
        }

        // If the gas price step is not changed, do not update.
        if (
          gasPriceStep.average === newGasPriceStep.average &&
          gasPriceStep.high === newGasPriceStep.high
        ) {
          console.error("No need to update");

          // continue 하면 while의 처음부터 시작되서 딜레이 없이 계속 돌아가서 2분 딜레이를 줬습니다.
          await new Promise((r) => setTimeout(r, 1000 * 60 * 2));
          continue;
        }

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
          content: Buffer.from(
            `${JSON.stringify(newChainInfo, null, 2)}\n`,
          ).toString("base64"),
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
    await new Promise((r) => setTimeout(r, 1000 * 60 * 2));
  }
})();
