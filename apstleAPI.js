const { channelMention } = require("discord.js");

const { APPSTLE_API_KEY, PRODUCT_URL, SUPPORT_CHANNEL_ID } = process.env;

const fetchCustomer = async (email) => {
	const res = await fetch(
		`https://subscription-admin.appstle.com/api/external/v2/subscription-contract-details/customers?api_key=${APPSTLE_API_KEY}&email=${email}`
	);

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
		`https://subscription-admin.appstle.com/api/external/v2/subscription-contract-details/?api_key=${APPSTLE_API_KEY}&${query}`
	);
	const data = await res.json();

	const contracts = data.filter((item) =>
		item.contractDetailsJSON.includes(PRODUCT_URL)
	);

	console.log(contracts);

	const curDate = new Date();

	for (const contract of contracts) {
		const { status, nextBillingDate, activatedOn, pausedOn } = contract;

		if (status === "active") return contract;

		console.log("not active");

		if (status === "cancelled") {
			if (new Date(nextBillingDate) < curDate) continue;

			console.log("cancelled but active");

			return contract;
		}

		if (status === "paused") {
			const pausedYear = new Date(pausedOn).getFullYear();
			const pausedMonth = new Date(pausedOn).getMonth();
			const activatedDay = new Date(activatedOn).getDate();
			const activatedMonth = new Date(activatedOn).getMonth();

			if (curDate.getFullYear() !== pausedYear) continue;

			if (
				activatedMonth === pausedMonth &&
				activatedMonth === curDate.getMonth()
			)
				return contract;

			if (
				pausedMonth === curDate.getMonth() ||
				pausedMonth === curDate.getMonth() - 1
			) {
				if (curDate.getDate() <= activatedDay + 1) return contract;
			}
		}
	}
};

module.exports = { fetchCustomer, fetchContracts };
