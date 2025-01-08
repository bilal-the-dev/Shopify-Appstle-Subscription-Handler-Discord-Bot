const { APPSTLE_API_KEY, TARGET_PRODUCT_ID } = process.env;

const fetchCustomer = async (email) => {
  const res = await fetch(
    `https://subscription-admin.appstle.com/api/external/v2/subscription-contract-details/customers?email=${email}`,
    { headers: { "x-api-key": APPSTLE_API_KEY } }
  );

  const data = await parseResponse(res);

  const user = data.find((item) => item.email === email);

  if (!user)
    throw new Error(
      `No subscription found for ${email}, please contact support`
    );

  return user;
};

const fetchContracts = async (query) => {
  const res = await fetch(
    `https://subscription-admin.appstle.com/api/external/v2/subscription-contract-details/?${query}&productId=${TARGET_PRODUCT_ID}`,
    { headers: { "x-api-key": APPSTLE_API_KEY } }
  );

  const contracts = await parseResponse(res);

  const response = { subscriptionFinished: true };

  console.log(contracts);

  const curTime = new Date().getTime();

  for (const contract of contracts) {
    response.contract = contract;
    const {
      status,
      nextBillingDate,
      lastSuccessfulOrder,
      billingPolicyIntervalCount,
    } = contract;

    const nextPaymentTime = new Date(nextBillingDate).getTime();

    let subscriptionFinished = true;
    if (status === "active") subscriptionFinished = false;

    if (status === "cancelled") {
      if (curTime > nextPaymentTime) {
        response.finishedAt = nextPaymentTime;
        continue;
      }

      subscriptionFinished = false;
    }

    if (status === "paused") {
      const parsedJSON = JSON.parse(lastSuccessfulOrder);

      const lastPaymentDate = new Date(parsedJSON.orderDate);

      lastPaymentDate.setMonth(
        lastPaymentDate.getMonth() + billingPolicyIntervalCount
      );

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

async function parseResponse(res) {
  let parsedRes;
  if (res.headers.get("content-type").includes("json"))
    parsedRes = await res.json();
  if (res.headers.get("content-type").includes("html")) {
    console.log(res);

    parsedRes = (await res.text()).slice(0, 1700);
    console.log(parsedRes);
    throw new Error("Something went wrong, please try again");
  }

  if (!res.ok) {
    throw new Error(JSON.stringify(parsedRes));
  }

  return parsedRes;
}
module.exports = { fetchCustomer, fetchContracts };
