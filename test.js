require("dotenv").config();
const { fetchContracts, fetchCustomer } = require("./apstleAPI");

async function test(params) {
  const r = await fetchCustomer("antonyyjas2005@icloud.com");
  console.log(r);
  const res = await fetchContracts("customerName=antonyyjas2005@icloud.com");
  console.log(res);
}

test();
