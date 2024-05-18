const { SUBSCRIPTION_ROLE_ID, VERIFIED_ROLE_ID } = process.env;

const addRoles = async (member) => await member.roles.add(SUBSCRIPTION_ROLE_ID);

const removeRoles = async (member) =>
  await Promise.all([
    member.roles.remove(VERIFIED_ROLE_ID),
    member.roles.remove(SUBSCRIPTION_ROLE_ID),
  ]);

const checkForRoles = (member) => member.roles.cache.has(SUBSCRIPTION_ROLE_ID);

module.exports = { addRoles, removeRoles, checkForRoles };
