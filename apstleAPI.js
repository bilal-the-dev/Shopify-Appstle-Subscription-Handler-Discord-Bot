const { channelMention } = require("discord.js");

const { APPSTLE_API_KEY, TARGET_PRODUCT_ID, SUPPORT_CHANNEL_ID } = process.env;

const fetchCustomer = async (email) => {
  const res = await fetch(
    `https://subscription-admin.appstle.com/api/external/v2/subscription-contract-details/customers?email=${email}`,
    { headers: { "x-api-key": APPSTLE_API_KEY } }
  );

  // console.log(res);
  const data = await res.json();

  // console.log(data);

  const user = data.find((item) => item.email === email);

  if (!user)
    throw new Error(
      `Kein Abonnement für ${email} gefunden, kontaktiere bitte den Support im ${channelMention(
        SUPPORT_CHANNEL_ID
      )} Channel“`
    );

  return user;
};

const fetchContracts = async (query) => {
  const res = await fetch(
    `https://subscription-admin.appstle.com/api/external/v2/subscription-contract-details/?${query}&productId=${TARGET_PRODUCT_ID}`,
    { headers: { "x-api-key": APPSTLE_API_KEY } }
  );

  const contracts = await res.json();

  if (!Array.isArray(contracts)) throw new Error(JSON.stringify(contracts));

  const response = { subscriptionFinished: true };

  console.log(contracts);

  const curTime = new Date().getTime();

  for (const contract of contracts) {
    response.contract = contract;
    const { status, nextBillingDate, lastSuccessfulOrder } = contract;

    const nextPaymentTime = new Date(nextBillingDate).getTime();

    let subscriptionFinished = true;
    if (status === "active") subscriptionFinished = false;

    console.log("not active");

    if (status === "cancelled") {
      if (curTime > nextPaymentTime) {
        response.finishedAt = nextPaymentTime;
        continue;
      }

      console.log("cancelled but active");

      subscriptionFinished = false;
    }

    if (status === "paused") {
      console.log("paused");

      const parsedJSON = JSON.parse(lastSuccessfulOrder);

      const lastPaymentDate = new Date(parsedJSON.orderDate);

      lastPaymentDate.setMonth(lastPaymentDate.getMonth() + 1);

      if (curTime > lastPaymentDate.getTime()) {
        response.finishedAt = lastPaymentDate.getTime();
        continue;
      }

      subscriptionFinished = false;
    }

    if (!subscriptionFinished) return { subscriptionFinished, contract };
  }

  return response;
};

module.exports = { fetchCustomer, fetchContracts };
