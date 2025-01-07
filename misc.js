const { variantsRoleMap } = require("./config.json");

const addRole = async (member, contract) => {
  const { roleId } = getVariantConfig(contract);

  await member.roles.add(roleId);

  return parseVariantId(contract);
};

const removeRole = async (member, contract) => {
  const { roleId } = getVariantConfig(contract);

  return member.roles.remove(roleId);
};

const checkForRole = (member, contract) => {
  const { roleId } = getVariantConfig(contract);

  return member.roles.cache.has(roleId);
};

const parseVariantId = (contract) => {
  const json = JSON.parse(contract.contractDetailsJSON)[0];
  return json.variantId.replace("gid://shopify/ProductVariant/", "");
};

const getVariantConfig = (contractOrVariantId) => {
  let variantId = contractOrVariantId;

  if (typeof contractOrVariantId === "object")
    variantId = parseVariantId(contractOrVariantId);

  const variant = variantsRoleMap.find((v) => v.variantIds.includes(variantId));

  if (!variant)
    throw new Error(
      "Something went wrong - Could not find role for the said variant"
    );
  console.log(variant);

  return variant;
};

module.exports = { addRole, removeRole, checkForRole };
