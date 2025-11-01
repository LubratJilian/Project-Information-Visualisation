function baseCountryCodeToFullName(code) {
    const countryCodes = {
        "KR": "South Korea",
        "": "Non défini",
        "IN": "India",
        "CL": "Chile",
        "US": "United States",
        "AR": "Argentina",
        "CA": "Canada",
        "JP": "Japan",
        "ES": "Spain",
        "TH": "Thailand",
        "PK": "Pakistan",
        "MX": "Mexico",
        "BR": "Brazil",
        "PR": "Puerto Rico",
        "SV": "El Salvador",
        "PH": "Philippines",
        "IE": "Ireland",
        "NO": "Norway",
        "AE": "United Arab Emirates",
        "GB": "United Kingdom",
        "CO": "Colombia",
        "ID": "Indonesia",
        "DE": "Germany",
        "NL": "Netherlands",
        "AU": "Australia",
        "IT": "Italy",
        "JO": "Jordan",
        "SA": "Saudi Arabia",
        "SE": "Sweden",
        "LV": "Latvia",
        "CH": "Switzerland",
        "KZ": "Kazakhstan",
        "VN": "Vietnam",
        "FR": "France",
        "RU": "Russia",
        "PE": "Peru",
        "EC": "Ecuador",
        "BD": "Bangladesh",
        "FI": "Finland",
        "TR": "Turkey",
        "UA": "Ukraine",
        "EG": "Egypt",
        "GR": "Greece",
        "CZ": "Czech Republic",
        "PL": "Poland",
        "RO": "Romania",
        "RS": "Serbia",
        "MA": "Morocco",
        "CN": "China",
        "LB": "Lebanon",
        "BG": "Bulgaria",
        "PY": "Paraguay",
        "DO": "Dominican Republic",
        "MY": "Malaysia",
        "TN": "Tunisia",
        "AT": "Austria",
        "SG": "Singapore",
        "AQ": "Antarctica",
        "UY": "Uruguay",
        "LK": "Sri Lanka",
        "NG": "Nigeria",
        "NP": "Nepal",
        "CY": "Cyprus",
        "IL": "Israel",
        "ZA": "South Africa",
        "SK": "Slovakia",
        "DK": "Denmark",
        "HU": "Hungary",
        "TW": "Taiwan",
        "PT": "Portugal",
        "HK": "Hong Kong",
        "DZ": "Algeria",
        "GE": "Georgia",
        "KE": "Kenya",
        "TZ": "Tanzania",
        "HR": "Croatia",
        "LY": "Libya",
        "MK": "North Macedonia",
        "KH": "Cambodia",
        "NZ": "New Zealand",
        "QA": "Qatar",
        "LU": "Luxembourg",
        "JM": "Jamaica",
        "AL": "Albania",
        "ZW": "Zimbabwe",
        "BE": "Belgium",
        "BY": "Belarus",
        "BA": "Bosnia and Herzegovina",
        "IQ": "Iraq",
        "VI": "U.S. Virgin Islands",
        "AF": "Afghanistan",
        "SI": "Slovenia",
        "IS": "Iceland",
        "EE": "Estonia",
        "GM": "Gambia",
        "MT": "Malta",
        "CX": "Christmas Island",
        "MC": "Monaco",
        "GH": "Ghana",
        "BM": "Bermuda",
        "AG": "Antigua and Barbuda",
        "CR": "Costa Rica",
        "LT": "Lithuania",
        "BH": "Bahrain",
        "LA": "Laos",
        "UG": "Uganda",
        "OM": "Oman",
        "MD": "Moldova",
        "HN": "Honduras",
        "ME": "Montenegro",
        "UM": "United States Minor Outlying Islands"
    };
    return countryCodes[code.toUpperCase()] || "Unknown Country";
}

function updateMultiSelectDisplay(selectedCountries) {
    const selectedText = document.getElementById('selected-countries');
    if (selectedCountries.length === 0)
        selectedText.textContent = 'Tous les pays';
    else if (selectedCountries.length === 1)
        selectedText.textContent = baseCountryCodeToFullName(selectedCountries[0]);
    else
        selectedText.textContent = `${selectedCountries.length} pays sélectionné(s)`;
}

function formatNumber(num) {
    return d3.format(".2s")(num);
}

function truncateText(textElement, width) {
    let text = textElement.text();
    let maxWidth = width - 8;
    let textLength = textElement.node().getComputedTextLength();

    if (!text || width <= 0 || maxWidth < 16) {
        textElement.text('');
        return;
    }

    while (textLength > maxWidth && text.length > 0) {
        text = text.slice(0, -1);
        textElement.text(text + '…');
        textLength = textElement.node().getComputedTextLength();
    }
}

export {baseCountryCodeToFullName, updateMultiSelectDisplay, formatNumber, truncateText};
