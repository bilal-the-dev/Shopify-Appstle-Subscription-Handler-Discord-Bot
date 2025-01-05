require("dotenv").config();
const { fetchContracts, fetchCustomer } = require("./apstleAPI");

async function test(params) {
  // const r = await fetchCustomer("huserm2@gmail.com");
  // console.log(r);
  const res = await fetchContracts("customerName=dreamtrader@fichte.eu");
  console.log(res);
}

test();
