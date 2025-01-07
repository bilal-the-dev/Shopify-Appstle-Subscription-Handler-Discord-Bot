require("dotenv").config();
const { fetchContracts, fetchCustomer } = require("./apstleAPI");

async function test(params) {
  const r = await fetchCustomer("Alexander.fereidooni@gmail.com");
  console.log(r);
  const res = await fetchContracts(
    "customerName=Alexander.fereidooni@gmail.com"
  );
  console.log(res);
}

test();
