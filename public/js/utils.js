export const callMyServer = async function (
  endpoint,
  isPost = false,
  postData = null
) {
  const optionsObj = isPost ? { method: "POST" } : {};
  if (isPost && postData !== null) {
    optionsObj.headers = { "Content-type": "application/json" };
    optionsObj.body = JSON.stringify(postData);
  }
  const response = await fetch(endpoint, optionsObj);
  if (response.status === 500) {
    await handleServerError(response);
    return;
  }
  const data = await response.json();
  console.log(`Result from calling ${endpoint}: ${JSON.stringify(data)}`);
  return data;
};

export const hideSelector = function (selector) {
  document.querySelector(selector).classList.add("d-none");
};

export const showSelector = function (selector) {
  document.querySelector(selector).classList.remove("d-none");
};

export const showOutput = function (textToShow) {
  if (textToShow == null) return;
  const output = document.querySelector("#output");
  output.textContent = textToShow;
};

export const humanReadableCategory = function (category) {
  return category
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (s) => s.toUpperCase())
    .replace(/\b(And|Or)\b/, (s) => s.toLowerCase());
};

const formatters = {
  USD: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }),
};

export const currencyAmount = function (amount, currencyCode) {
  try {
    // Create a new formatter if this doesn't exist
    if (formatters[currencyCode] == null) {
      formatters[currencyCode] = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode,
      });
    }
    return formatters[currencyCode].format(amount);
  } catch (error) {
    console.log(error);
    return amount;
  }
};

const handleServerError = async function (responseObject) {
  const error = await responseObject.json();
  console.error("I received an error ", error);
  if (error.hasOwnProperty("error_message")) {
    showOutput(`Error: ${error.error_message} -- See console for more`);
  }
};

export const resetUI = function () {
  showOutput("");
  document.querySelector("#username").value = "";
  document.querySelector("#email").value = "";
};
