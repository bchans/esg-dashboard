document.addEventListener('DOMContentLoaded', async function() {

    am4core.useTheme(am4themes_animated);

    let esgData = {};
    let partialGlobe, fullGlobe, miniGlobe;
    let fullPolygonSeries, miniPolygonSeries;
    // Initialize as empty, will be populated from data.json
    let countryListForDropdown = [];
    let tagifyInstance = null;
    let tagifyInstanceFull = null;
    let wizardHqCountryId = null;
    let wizardOperatingCountryIds = [];
    let carouselCountries = [];
    let currentCarouselIndex = -1;
    let activePolygon = null;
    let hqState;
    let currentAssessmentMode = 'quick-scan'; // Track current tab

    // Full Assessment Step Management
    let currentStep = 0;
    let totalSteps = 3;
    const stepNames = ['Company Profile', 'Financials', 'Corporate Structure & Listing'];
    let completedSteps = [];

    const gicsSectors = [
        "Energy", "Materials", "Industrials", "Consumer Discretionary",
        "Consumer Staples", "Health Care", "Financials", "Information Technology",
        "Communication Services", "Utilities", "Real Estate"
    ];

    // --- Get DOM Elements ---
    const countryDataContainer = document.getElementById('country-data-container');
    const wizardView = document.getElementById('wizard-view');
    const countryDataContent = document.getElementById('country-data-content');
    const wizardForm = document.getElementById('wizard-form');
    const wizardEmployeesInput = document.getElementById('wizard-employees');
    const wizardSectorSelect = document.getElementById('wizard-sector');
    const wizardHqCountrySelect = document.getElementById('wizard-hq-country');
    const wizardOperatingCountriesInput = document.getElementById('wizard-operating-countries');
    
    // Full assessment elements
    const wizardEmployeesFteInput = document.getElementById('wizard-employees-fte');
    const wizardSectorFullSelect = document.getElementById('wizard-sector-full');
    const wizardHqCountryFullSelect = document.getElementById('wizard-hq-country-full');
    const wizardOperatingCountriesFullInput = document.getElementById('wizard-operating-countries-full');

    const wizardTurnoverInput = document.getElementById('wizard-turnover');
    const wizardAssetsInput = document.getElementById('wizard-assets');
    const wizardListingSelect = document.getElementById('wizard-listing');
    const wizardCorporateRoleSelect = document.getElementById('wizard-corporate-role');
    const wizardNonEuTurnoverInput = document.getElementById('wizard-non-eu-turnover');
    const nonEuTurnoverField = document.getElementById('non-eu-turnover-field');
    
    const wizardResultsDiv = document.getElementById('wizard-results');
    const wizardResultsList = document.getElementById('wizard-results-list');
    const resultsTitle = document.getElementById('results-title');
    const backToFormBtn = document.getElementById('back-to-form-btn'); // Added back button element
    const viewCountryDetailsBtn = document.getElementById('view-country-details-btn');
    const loadingIndicator = document.getElementById('loading-indicator');
    const backToWizardBtn = document.getElementById('back-to-wizard-btn');
    const topBackBtn = document.getElementById('top-back-btn');
    const wizardTopBackBtn = document.getElementById('wizard-top-back-btn');
    const carouselControls = document.getElementById('carousel-controls');
    const carouselPrevBtn = document.getElementById('carousel-prev');
    const carouselNextBtn = document.getElementById('carousel-next');
    const carouselInfo = document.getElementById('carousel-info');

    // --- State Management ---
    function setPanelState(state) { // 'wizard' or 'country' or 'loading'
        if (!countryDataContainer) return;
        countryDataContainer.classList.remove('view-wizard', 'view-country-data');
        loadingIndicator?.classList.add('hidden');
        carouselControls?.classList.add('hidden');
        topBackBtn?.classList.add('hidden');
        wizardTopBackBtn?.classList.add('hidden');

        if (state === 'country') {
            countryDataContainer.classList.add('view-country-data');
            topBackBtn?.classList.remove('hidden');
        } else if (state === 'loading') {
            loadingIndicator?.classList.remove('hidden');
            countryDataContainer.classList.add('view-wizard');
        } else { // Default to 'wizard'
            countryDataContainer.classList.add('view-wizard');
            wizardResultsDiv?.classList.add('hidden');
            viewCountryDetailsBtn?.classList.add('hidden');
            clearMultiCountryHighlights();
        }
    }

    // --- Loading State ---
    function showLoading(text = 'Loading Country Data...') { 
        if (loadingIndicator) {
            const loadingText = loadingIndicator.querySelector('p');
            if (loadingText) {
                loadingText.textContent = text;
            }
        }
        setPanelState('loading'); 
    }
    function hideLoading() { /* setPanelState handles hiding */ }

    // --- Populate Dropdowns & Tagify ---
    function populateGicsSectors() {
        // Populate quick scan sector dropdown
        if (wizardSectorSelect) {
            wizardSectorSelect.innerHTML = '<option value="">-- Select Sector --</option>';
            gicsSectors.forEach(sector => {
                const option = document.createElement('option');
                option.value = sector.toLowerCase().replace(/ /g, '-');
                option.textContent = sector;
                wizardSectorSelect.appendChild(option);
            });
        }
        
        // Populate full assessment sector dropdown
        if (wizardSectorFullSelect) {
            wizardSectorFullSelect.innerHTML = '<option value="">-- Select Sector --</option>';
            gicsSectors.forEach(sector => {
                const option = document.createElement('option');
                option.value = sector.toLowerCase().replace(/ /g, '-');
                option.textContent = sector;
                wizardSectorFullSelect.appendChild(option);
            });
        }
    }

    function populateCountriesDropdowns() {
        console.log("Populating dropdowns from countryList (size):", countryListForDropdown.length);
        if (countryListForDropdown.length === 0) {
            console.warn("Cannot populate dropdowns, country list derived from JSON is empty.");
            if (wizardHqCountrySelect) wizardHqCountrySelect.innerHTML = '<option value="">No countries in data</option>';
            if (tagifyInstance) { try { tagifyInstance.destroy(); tagifyInstance = null;} catch(e){} }
            if (wizardOperatingCountriesInput) wizardOperatingCountriesInput.placeholder = "No countries in data";
            return;
        }
        // Sort list alphabetically by name for user convenience
        const sortedCountries = [...countryListForDropdown].sort((a, b) => a.name.localeCompare(b.name));

        // Populate HQ Select (Quick Scan)
        if (wizardHqCountrySelect) {
            wizardHqCountrySelect.innerHTML = '<option value="">-- Select HQ Country --</option>';
            sortedCountries.forEach(country => {
                const option = document.createElement('option');
                option.value = country.id; // ID (e.g., "DE")
                option.textContent = country.name; // Name (e.g., "Germany")
                wizardHqCountrySelect.appendChild(option);
            });
            console.log("HQ Select (Quick Scan) populated.");
            
            // Add event listener to HQ country select to update Tagify whitelist
            wizardHqCountrySelect.addEventListener('change', updateOperatingCountriesWhitelist);
        }
        
        // Populate HQ Select (Full Assessment)
        if (wizardHqCountryFullSelect) {
            wizardHqCountryFullSelect.innerHTML = '<option value="">-- Select HQ Country --</option>';
            sortedCountries.forEach(country => {
                const option = document.createElement('option');
                option.value = country.id;
                option.textContent = country.name;
                wizardHqCountryFullSelect.appendChild(option);
            });
            console.log("HQ Select (Full Assessment) populated.");
            
            // Add event listener for full assessment
            wizardHqCountryFullSelect.addEventListener('change', updateOperatingCountriesWhitelistFull);
        }

        // Initialize Tagify for both quick scan and full assessment
        if (wizardOperatingCountriesInput && Tagify) {
            initializeTagify(sortedCountries);
        } else {
             if (!wizardOperatingCountriesInput) console.error("Quick scan Tagify input element not found!");
             if (!Tagify) console.error("Tagify library not loaded!");
        }
        
        if (wizardOperatingCountriesFullInput && Tagify) {
            initializeTagifyFull(sortedCountries);
        } else {
             if (!wizardOperatingCountriesFullInput) console.error("Full assessment Tagify input element not found!");
        }
    }

    function initializeTagify(sortedCountries) {
        // Whitelist for Tagify needs 'value' for display text and 'id' for internal value
        const tagifyWhitelist = sortedCountries.map(country => ({
            value: country.name, // What the user sees and searches
            id: country.id       // What gets stored internally
        }));

        if (tagifyInstance) { try { tagifyInstance.destroy(); } catch (e) {} }

        try {
            tagifyInstance = new Tagify(wizardOperatingCountriesInput, {
                whitelist: tagifyWhitelist,
                dropdown: { maxItems: 10, enabled: 0, closeOnSelect: false, position: "input" },
                enforceWhitelist: true,
                mapValueToProp: "id", // Store the 'id' property internally when a tag is created
                placeholder: "Type to add countries...",
            });
            console.log("Tagify initialized with whitelist size:", tagifyWhitelist.length);
        } catch (tagifyError) {
            console.error("!!! Failed to initialize Tagify:", tagifyError);
        }
    }

    function initializeTagifyFull(sortedCountries) {
        // Whitelist for Tagify needs 'value' for display text and 'id' for internal value
        const tagifyWhitelist = sortedCountries.map(country => ({
            value: country.name, // What the user sees and searches
            id: country.id       // What gets stored internally
        }));

        if (tagifyInstanceFull) { try { tagifyInstanceFull.destroy(); } catch (e) {} }

        try {
            tagifyInstanceFull = new Tagify(wizardOperatingCountriesFullInput, {
                whitelist: tagifyWhitelist,
                dropdown: { maxItems: 10, enabled: 0, closeOnSelect: false, position: "input" },
                enforceWhitelist: true,
                mapValueToProp: "id", // Store the 'id' property internally when a tag is created
                placeholder: "Type to add countries...",
            });
            
            // Add event listeners for tag changes to update conditional fields
            tagifyInstanceFull.on('add', updateConditionalFields);
            tagifyInstanceFull.on('remove', updateConditionalFields);
            
            console.log("Tagify Full Assessment initialized with whitelist size:", tagifyWhitelist.length);
        } catch (tagifyError) {
            console.error("!!! Failed to initialize Tagify Full Assessment:", tagifyError);
        }
    }

    function updateOperatingCountriesWhitelist() {
        if (!tagifyInstance || !wizardHqCountrySelect) return;
        
        const selectedHqId = wizardHqCountrySelect.value;
        const sortedCountries = [...countryListForDropdown].sort((a, b) => a.name.localeCompare(b.name));
        
        // Filter out the HQ country from the whitelist
        const filteredCountries = sortedCountries.filter(country => country.id !== selectedHqId);
        const tagifyWhitelist = filteredCountries.map(country => ({
            value: country.name,
            id: country.id
        }));

        // Update Tagify whitelist
        tagifyInstance.whitelist = tagifyWhitelist;

        // Remove HQ country tag if it exists in operating countries
        if (selectedHqId) {
            const existingTags = tagifyInstance.value;
            const filteredTags = existingTags.filter(tag => tag.id !== selectedHqId);
            if (filteredTags.length !== existingTags.length) {
                tagifyInstance.removeAllTags();
                filteredTags.forEach(tag => tagifyInstance.addTags([tag]));
            }
        }
    }

    function updateOperatingCountriesWhitelistFull() {
        if (!tagifyInstanceFull || !wizardHqCountryFullSelect) return;
        
        const selectedHqId = wizardHqCountryFullSelect.value;
        const sortedCountries = [...countryListForDropdown].sort((a, b) => a.name.localeCompare(b.name));
        
        // Filter out the HQ country from the whitelist
        const filteredCountries = sortedCountries.filter(country => country.id !== selectedHqId);
        const tagifyWhitelist = filteredCountries.map(country => ({
            value: country.name,
            id: country.id
        }));

        // Update Tagify whitelist
        tagifyInstanceFull.whitelist = tagifyWhitelist;

        // Remove HQ country tag if it exists in operating countries
        if (selectedHqId) {
            const existingTags = tagifyInstanceFull.value;
            const filteredTags = existingTags.filter(tag => tag.id !== selectedHqId);
            if (filteredTags.length !== existingTags.length) {
                tagifyInstanceFull.removeAllTags();
                filteredTags.forEach(tag => tagifyInstanceFull.addTags([tag]));
            }
        }
        
        // Update conditional field visibility
        updateConditionalFields();
    }

    function updateConditionalFields() {
        const corporateRole = wizardCorporateRoleSelect?.value;
        const operatingTags = tagifyInstanceFull ? tagifyInstanceFull.value : [];
        
        // Show non-EU turnover field if:
        // 1. Corporate role is NOT standalone, OR
        // 2. Any operating country is in the EU
        const isNotStandalone = corporateRole && corporateRole !== 'standalone';
        const hasEuOperatingCountries = operatingTags.some(tag => europeanUnionIds.includes(tag.id));
        
        if (nonEuTurnoverField) {
            if (isNotStandalone || hasEuOperatingCountries) {
                nonEuTurnoverField.classList.add('show');
            } else {
                nonEuTurnoverField.classList.remove('show');
            }
        }
    }

    // --- Fetch ESG Data ---
    try {
        const response = await fetch('data.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        esgData = await response.json();
        console.log("ESG Data loaded successfully.");

        // <<< --- GENERATE COUNTRY LIST FROM JSON DATA --- >>>
        countryListForDropdown = Object.keys(esgData).map(countryCode => {
            const countryData = esgData[countryCode];
            return {
                id: countryCode, // The key is the ID (e.g., "DE")
                name: countryData?.countryName || countryCode // Use name from JSON, fallback to code
            };
        }).filter(country => country.name); // Ensure we have a name to display

        console.log("Country list generated from data.json:", countryListForDropdown.length);

        if (countryListForDropdown.length > 0) {
            // Populate dropdowns AFTER the list is generated from JSON
            populateCountriesDropdowns();
        } else {
            console.error("Failed to generate country list from data.json (JSON might be empty or malformed)");
            // Handle error state for dropdowns
            if(wizardHqCountrySelect) wizardHqCountrySelect.innerHTML = '<option value="">No countries in data</option>';
            if(wizardOperatingCountriesInput) wizardOperatingCountriesInput.placeholder = "No countries in data";
        }
        // <<< --- END GENERATION --- >>>

    } catch (error) {
        console.error("Could not fetch or process ESG data:", error);
        if(wizardView) {
            wizardView.innerHTML = `<p style="color: red; text-align: center; padding: 20px;">Error loading core ESG data. Site functionality may be limited. Please try again later.</p>`;
        }
        // Ensure dropdowns reflect error state even if they were populated briefly before error
         if(wizardHqCountrySelect) wizardHqCountrySelect.innerHTML = '<option value="">Error loading data</option>';
         if(wizardOperatingCountriesInput) wizardOperatingCountriesInput.placeholder = "Error loading data";
        setPanelState('wizard'); // Keep wizard structure visible for error message
    }

    // --- Partial Globe ---
    try {
        // ... (Partial Globe code remains exactly the same) ...
        partialGlobe = am4core.create("globe-partial", am4maps.MapChart);
        partialGlobe.geodata = am4geodata_worldLow;
        partialGlobe.projection = new am4maps.projections.Orthographic();
        partialGlobe.panBehavior = "rotateLongLat"; partialGlobe.deltaLatitude = -30; partialGlobe.deltaLongitude = 55;
        let partialPolygonSeries = partialGlobe.series.push(new am4maps.MapPolygonSeries());
        partialPolygonSeries.useGeodata = true;
        partialPolygonSeries.mapPolygons.template.fill = am4core.color("#a0daff");
        partialPolygonSeries.mapPolygons.template.stroke = am4core.color("#FFFFFF"); partialPolygonSeries.mapPolygons.template.strokeWidth = 0.5; partialPolygonSeries.mapPolygons.template.tooltipText = "";
        partialGlobe.chartContainer.wheelable = false; partialGlobe.seriesContainer.draggable = false; partialGlobe.seriesContainer.resizable = false;
        partialGlobe.homeZoomLevel = 1.9; partialGlobe.homeGeoPoint = { longitude: 10, latitude: 52 };
        let rotationTimer; const rotationSpeed = 0.04;
        function startRotation() { if (rotationTimer) clearInterval(rotationTimer); rotationTimer = setInterval(() => { if (partialGlobe && !partialGlobe.isDisposed()) { partialGlobe.deltaLongitude += rotationSpeed; } else { clearInterval(rotationTimer); } }, 30); }
        partialGlobe.events.on("ready", startRotation);
        partialGlobe.events.on("disposed", () => { if (rotationTimer) clearInterval(rotationTimer); });
    } catch (e) { console.error("Error initializing partial globe:", e); }


    // --- Full Interactive Globe ---
    try {
        fullGlobe = am4core.create("globe-full", am4maps.MapChart);
        console.log("Globe chart created.");
        fullGlobe.geodata = am4geodata_worldLow; // Assign geodata
        fullGlobe.projection = new am4maps.projections.Orthographic(); fullGlobe.panBehavior = "rotateLongLat";
        fullGlobe.background.fill = am4core.color("#e9ecef"); fullGlobe.background.fillOpacity = 1;

        fullPolygonSeries = fullGlobe.series.push(new am4maps.MapPolygonSeries());
        console.log("Polygon series created.");
        fullPolygonSeries.useGeodata = true; // Use chart's geodata

        // Map data validation listener - NO LONGER populates dropdowns
        fullPolygonSeries.events.on("datavalidated", () => {
            console.log("Map data validated event fired.");
            // We don't need to populate the country list here anymore.
            // Could potentially do other map-related setup if needed.
        });

        fullPolygonSeries.events.on("error", (ev) => { console.error("!!! Polygon Series Error:", ev.event); });
        fullGlobe.events.on("error", (ev) => { console.error("!!! Globe Chart Error:", ev.event); });


        let polygonTemplate = fullPolygonSeries.mapPolygons.template;
        polygonTemplate.tooltipText = "{name}";
        polygonTemplate.fill = am4core.color("#cde4f5");
        polygonTemplate.stroke = am4core.color("#FFFFFF"); polygonTemplate.strokeWidth = 0.5;
        polygonTemplate.cursorOverStyle = am4core.MouseCursorStyle.pointer;

        // Map States
        let hs = polygonTemplate.states.create("hover"); hs.properties.fill = am4core.color("#87ceeb");
        let activeState = polygonTemplate.states.create("active"); activeState.properties.fill = am4core.color("#007bff");
        hqState = polygonTemplate.states.create("hq"); hqState.properties.fill = am4core.color("#ff8c00");

        // --- Single Country Click Logic ---
        polygonTemplate.events.on("hit", function(ev) {
            if (Object.keys(esgData).length === 0) return;
            let clickedCountryId = ev.target.dataItem.dataContext.id;
            let clickedCountryName = ev.target.dataItem.dataContext.name;

            // Only proceed if we have data for this country in our JSON
            if (!esgData[clickedCountryId]) {
                 console.log(`Clicked on map country (${clickedCountryName}), but no data in data.json.`);
                 // Optional: Show a brief message? Or just do nothing?
                 // Let's do nothing for now to avoid confusion with the wizard flow.
                 // If needed, add a temporary status message area.
                 return;
            }

            carouselCountries = []; currentCarouselIndex = -1; // Reset carousel

            if (activePolygon && activePolygon !== ev.target) activePolygon.isActive = false;
            activePolygon = ev.target;
            activePolygon.isActive = true;

            setPanelState('country'); // Switch view (clears wizard highlights)

            fullGlobe.zoomToMapObject(ev.target, undefined, true, 1000);

            // We already checked esgData[clickedCountryId] exists
            displayCountryData(esgData[clickedCountryId]);
        });

        // --- Multi-Country Highlight Logic ---
        // clearMultiCountryHighlights() and highlightWizardCountries() remain the same
        function clearMultiCountryHighlights() {
            if (wizardHqCountryId && fullPolygonSeries) {
                const hqPolygon = fullPolygonSeries.getPolygonById(wizardHqCountryId);
                if (hqPolygon) { hqPolygon.isActive = false; hqPolygon.setState("default", 0); }
            }
            if (wizardOperatingCountryIds.length > 0 && fullPolygonSeries) {
                wizardOperatingCountryIds.forEach(countryId => {
                    const polygon = fullPolygonSeries.getPolygonById(countryId);
                    if (polygon) polygon.isActive = false;
                });
            }
            if (activePolygon) {
                activePolygon.isActive = false;
                activePolygon = null;
            }
            wizardHqCountryId = null;
            wizardOperatingCountryIds = [];
        }

        function highlightWizardCountries(hqId, subsidiaryIds) {
            clearMultiCountryHighlights();
            if (!fullPolygonSeries) return;
            wizardHqCountryId = hqId;
            wizardOperatingCountryIds = subsidiaryIds;

            if (hqId) {
                const hqPolygon = fullPolygonSeries.getPolygonById(hqId);
                if (hqPolygon) { hqPolygon.setState("hq"); }
                else console.warn("Could not find HQ polygon:", hqId);
            }
            subsidiaryIds.forEach(countryId => {
                if (countryId !== hqId) {
                    const polygon = fullPolygonSeries.getPolygonById(countryId);
                    if (polygon) { polygon.isActive = true; }
                    else console.warn("Could not find subsidiary polygon:", countryId);
                }
            });
        }

        // --- Display Functions ---
        // displayCountryData() remains the same
        function displayCountryData(countryData, countryNameIfNoData = "the selected region") {
            const nameDisplay = document.getElementById('country-name-display');
            const overallScoreVal = document.getElementById('overall-score-value');
            const envScoreNum = document.getElementById('env-score-number'); const socScoreNum = document.getElementById('soc-score-number'); const govScoreNum = document.getElementById('gov-score-number');
            const envBar = document.getElementById('env-progress-bar'); const socBar = document.getElementById('soc-progress-bar'); const govBar = document.getElementById('gov-progress-bar');
            const regulationsList = document.getElementById('regulations-list-dynamic');
            const metricsTitle = document.getElementById('metrics-title'); const metricsList = document.getElementById('key-metrics-list');

            if (!nameDisplay || !regulationsList /*... check others */) { console.error("Display elements missing"); return; }

             if (!countryData) { // Should only happen now if directly clicking map for non-JSON country
                 nameDisplay.textContent = `${countryNameIfNoData} - ESG Profile`;
                 overallScoreVal.textContent = '--'; envScoreNum.textContent = '--/100'; socScoreNum.textContent = '--/100'; govScoreNum.textContent = '--/100';
                 envBar.style.width = '0%'; socBar.style.width = '0%'; govBar.style.width = '0%';
                 regulationsList.innerHTML = '<p><i>Detailed ESG data not available for this region in our dataset.</i></p>';
                 metricsTitle.classList.add('hidden'); metricsList.classList.add('hidden');
             } else { // Populate with data
                 nameDisplay.textContent = `${countryData.countryName} ESG Profile`;
                 overallScoreVal.textContent = countryData.overallESGScore ?? '--';
                 envScoreNum.textContent = `${countryData.environmentalScore ?? '--'}/100`; socScoreNum.textContent = `${countryData.socialScore ?? '--'}/100`; govScoreNum.textContent = `${countryData.governanceScore ?? '--'}/100`;
                 envBar.style.width = `${countryData.environmentalScore || 0}%`; socBar.style.width = `${countryData.socialScore || 0}%`; govBar.style.width = `${countryData.governanceScore || 0}%`;

                 // Regulations list - using same styling as wizard results
                 regulationsList.innerHTML = '';
                 if (countryData.regulations && countryData.regulations.length > 0) {
                     countryData.regulations.forEach((reg, index) => {
                         const item = document.createElement('div');
                         item.className = 'regulation-item expandable';
                         item.dataset.category = reg.category || 'Other';
                         
                         const iconContainer = document.createElement('div');
                         iconContainer.className = 'regulation-icon-container';
                         
                         const icon = document.createElement('span');
                         icon.className = 'regulation-icon';
                         
                         // Determine icon and color based on status
                         if (reg.status === 'Enacted') {
                             icon.textContent = '✓';
                             icon.style.color = '#28a745';
                             iconContainer.style.backgroundColor = '#e8f5e8';
                         } else if (reg.status === 'Adopted' || reg.status.includes('Adopted')) {
                             icon.textContent = '⏳';
                             icon.style.color = '#ffc107';
                             iconContainer.style.backgroundColor = '#fff8e1';
                         } else if (reg.status === 'Proposed') {
                             icon.textContent = '📋';
                             icon.style.color = '#6c757d';
                             iconContainer.style.backgroundColor = '#f8f9fa';
                         } else if (reg.status === 'Replaced by CSRD') {
                             icon.textContent = '🔄';
                             icon.style.color = '#6c757d';
                             iconContainer.style.backgroundColor = '#f8f9fa';
                         } else {
                             icon.textContent = '📄';
                             icon.style.color = '#007bff';
                             iconContainer.style.backgroundColor = '#e3f2fd';
                         }
                         
                         iconContainer.appendChild(icon);
                         
                         const contentDiv = document.createElement('div');
                         contentDiv.className = 'regulation-content';
                         
                         const headerDiv = document.createElement('div');
                         headerDiv.className = 'regulation-header';
                         
                         const title = document.createElement('h6');
                         title.className = 'regulation-title';
                         title.textContent = reg.name;
                         
                         const expandIcon = document.createElement('span');
                         expandIcon.className = 'expand-icon';
                         expandIcon.textContent = '▼';
                         
                         const statusBadge = document.createElement('span');
                         statusBadge.className = `status-badge status-${reg.status?.toLowerCase().replace(/\s+/g, '-') || 'unknown'}`;
                         statusBadge.textContent = reg.status || 'Unknown';
                         
                         const yearBadge = document.createElement('span');
                         yearBadge.className = 'year-badge';
                         yearBadge.textContent = reg.year || 'N/A';
                         
                         headerDiv.appendChild(title);
                         headerDiv.appendChild(expandIcon);
                         headerDiv.appendChild(statusBadge);
                         headerDiv.appendChild(yearBadge);
                         
                         const description = document.createElement('p');
                         description.className = 'regulation-description';
                         description.textContent = reg.description || 'No description available.';
                         
                         contentDiv.appendChild(headerDiv);
                         contentDiv.appendChild(description);
                         
                         // Create main content wrapper
                         const mainContent = document.createElement('div');
                         mainContent.className = 'regulation-main-content';
                         mainContent.appendChild(iconContainer);
                         mainContent.appendChild(contentDiv);
                         
                         // Create expandable section
                         const expandableSection = document.createElement('div');
                         expandableSection.className = 'regulation-expandable hidden';
                         
                         // Add applicability information if available
                         const applicabilityContent = createApplicabilityContent(reg, countryData.countryName);
                         expandableSection.appendChild(applicabilityContent);
                         
                         item.appendChild(mainContent);
                         item.appendChild(expandableSection);
                         
                         // Add click event listener for expansion
                         item.addEventListener('click', () => toggleRegulationExpansion(item));
                         
                         regulationsList.appendChild(item);
                     });
                 } else { 
                     const noResults = document.createElement('div');
                     noResults.className = 'no-regulations-message';
                     noResults.innerHTML = `
                         <div class="no-results-icon">📋</div>
                         <p>No specific regulations listed in our dataset.</p>
                         <p class="no-results-subtitle">Regulations may exist but are not included in our current data.</p>
                     `;
                     regulationsList.appendChild(noResults);
                 }

                 // Metrics list
                 if (countryData.keyMetrics && countryData.keyMetrics.length > 0) {
                     metricsList.innerHTML = '';
                     countryData.keyMetrics.forEach(metric => { const li = document.createElement('li'); li.textContent = metric; metricsList.appendChild(li); });
                     metricsTitle.classList.remove('hidden'); metricsList.classList.remove('hidden');
                 } else { metricsList.innerHTML = ''; metricsTitle.classList.add('hidden'); metricsList.classList.add('hidden'); }
             }
        }

        // --- Carousel Logic ---
        // showCountryCarousel() remains the same
         function showCountryCarousel(startIndex = 0) {
             if (carouselCountries.length === 0) { setPanelState('wizard'); return; }
             hideLoading(); // Ensure loading is hidden
             setPanelState('country'); // Set view
             carouselControls?.classList.remove('hidden'); // Show controls

             currentCarouselIndex = Math.max(0, Math.min(startIndex, carouselCountries.length - 1)); // Clamp index

             const currentCountryInfo = carouselCountries[currentCarouselIndex];
             const countryId = currentCountryInfo.id;

             // Display data - USE esgData from JSON
             if (esgData && esgData[countryId]) {
                 displayCountryData(esgData[countryId]);
             } else {
                  // This case should be rarer now as carouselCountries is built from data.json keys
                  console.warn(`Data for carousel country ${countryId} not found in esgData.`);
                  displayCountryData(null, currentCountryInfo.name);
             }


             // Update info text
             if (carouselInfo) {
                 let infoText = `${currentCountryInfo.name}`;
                 if (currentCountryInfo.isHQ) infoText += " (HQ)";
                 infoText += ` (${currentCarouselIndex + 1} of ${carouselCountries.length})`;
                 carouselInfo.textContent = infoText;
             }

             // Update button states
             if (carouselPrevBtn) carouselPrevBtn.disabled = (currentCarouselIndex === 0);
             if (carouselNextBtn) carouselNextBtn.disabled = (currentCarouselIndex === carouselCountries.length - 1);
         }

         carouselPrevBtn?.addEventListener('click', () => { if (currentCarouselIndex > 0) showCountryCarousel(currentCarouselIndex - 1); });
         carouselNextBtn?.addEventListener('click', () => { if (currentCarouselIndex < carouselCountries.length - 1) showCountryCarousel(currentCarouselIndex + 1); });


        fullGlobe.events.on("ready", () => { console.log("Globe chart is ready."); });
        fullGlobe.events.on("disposed", () => { console.log("Full globe disposed."); });

    } catch (e) { // Globe initialization error
        console.error("Error initializing full globe:", e);
        if(wizardView) { wizardView.innerHTML = `<p style="color: red; text-align: center; padding: 20px;">Error initializing interactive globe. Site functionality may be limited.</p>`; }
        setPanelState('wizard');
    }

    // --- Mini Globe for Results ---
    function createMiniGlobe() {
        try {
            if (miniGlobe && !miniGlobe.isDisposed()) {
                miniGlobe.dispose();
            }

            miniGlobe = am4core.create("mini-globe", am4maps.MapChart);
            miniGlobe.geodata = am4geodata_worldLow;
            miniGlobe.projection = new am4maps.projections.Orthographic();
            miniGlobe.panBehavior = "rotateLongLat";
            miniGlobe.background.fill = am4core.color("#f8f9fa");
            miniGlobe.background.fillOpacity = 1;

            miniPolygonSeries = miniGlobe.series.push(new am4maps.MapPolygonSeries());
            miniPolygonSeries.useGeodata = true;

            let miniPolygonTemplate = miniPolygonSeries.mapPolygons.template;
            miniPolygonTemplate.tooltipText = "{name}";
            miniPolygonTemplate.fill = am4core.color("#e9ecef");
            miniPolygonTemplate.stroke = am4core.color("#FFFFFF");
            miniPolygonTemplate.strokeWidth = 0.5;

            // States for mini globe
            let miniActiveState = miniPolygonTemplate.states.create("active");
            miniActiveState.properties.fill = am4core.color("#007bff");
            let miniHqState = miniPolygonTemplate.states.create("hq");
            miniHqState.properties.fill = am4core.color("#ff8c00");

            // Disable interactions to keep it simple
            miniGlobe.chartContainer.wheelable = false;
            miniGlobe.seriesContainer.draggable = false;
            miniGlobe.seriesContainer.resizable = false;

            return miniGlobe;
        } catch (e) {
            console.error("Error creating mini globe:", e);
            return null;
        }
    }

    function highlightMiniGlobeCountries(hqId, operatingIds) {
        if (!miniPolygonSeries) return;

        // Reset all countries first
        miniPolygonSeries.mapPolygons.each(polygon => {
            polygon.isActive = false;
            polygon.setState("default");
        });

        // Highlight HQ
        if (hqId) {
            const hqPolygon = miniPolygonSeries.getPolygonById(hqId);
            if (hqPolygon) {
                hqPolygon.setState("hq");
            }
        }

        // Highlight operating countries
        operatingIds.forEach(countryId => {
            if (countryId !== hqId) {
                const polygon = miniPolygonSeries.getPolygonById(countryId);
                if (polygon) {
                    polygon.isActive = true;
                }
            }
        });

        // Center and zoom on HQ country with better positioning
        if (hqId) {
            const hqPolygon = miniPolygonSeries.getPolygonById(hqId);
            if (hqPolygon && hqPolygon.polygon) {
                try {
                    // Get country coordinates
                    const coordinates = getCountryCoordinates(hqId);
                    
                    if (coordinates) {
                        // Set home position to HQ country
                        miniGlobe.homeGeoPoint = coordinates;
                        
                        // Set zoom level for better view (showing neighboring countries)
                        miniGlobe.homeZoomLevel = 3;
                        miniGlobe.zoomLevel = 3;
                        
                        // Go to home position
                        miniGlobe.goHome();
                    }
                } catch (e) {
                    console.error("Error centering mini globe:", e);
                }
            }
        }
    }

    // Helper function to get country coordinates
    function getCountryCoordinates(countryId) {
        const coordinates = {
            'DE': { longitude: 10.45, latitude: 51.16 },
            'FR': { longitude: 2.21, latitude: 46.23 },
            'GB': { longitude: -3.44, latitude: 55.38 },
            'IT': { longitude: 12.57, latitude: 41.87 },
            'ES': { longitude: -3.75, latitude: 40.46 },
            'NL': { longitude: 5.29, latitude: 52.13 },
            'BE': { longitude: 4.47, latitude: 50.50 },
            'CH': { longitude: 8.23, latitude: 46.82 },
            'AT': { longitude: 14.55, latitude: 47.52 },
            'PL': { longitude: 19.13, latitude: 51.92 },
            'SE': { longitude: 18.64, latitude: 60.13 },
            'NO': { longitude: 8.47, latitude: 60.47 },
            'DK': { longitude: 9.50, latitude: 56.26 },
            'FI': { longitude: 25.75, latitude: 61.92 },
            'IE': { longitude: -8.24, latitude: 53.41 },
            'PT': { longitude: -8.22, latitude: 39.40 },
            'GR': { longitude: 21.82, latitude: 39.07 },
            'CZ': { longitude: 15.47, latitude: 49.82 },
            'HU': { longitude: 19.50, latitude: 47.16 },
            'SK': { longitude: 19.70, latitude: 48.67 },
            'SI': { longitude: 14.99, latitude: 46.15 },
            'HR': { longitude: 15.20, latitude: 45.10 },
            'BG': { longitude: 25.48, latitude: 42.73 },
            'RO': { longitude: 24.97, latitude: 45.94 },
            'EE': { longitude: 25.01, latitude: 58.60 },
            'LV': { longitude: 24.60, latitude: 56.88 },
            'LT': { longitude: 23.88, latitude: 55.17 },
            'LU': { longitude: 6.13, latitude: 49.82 },
            'MT': { longitude: 14.38, latitude: 35.94 },
            'CY': { longitude: 33.43, latitude: 35.13 },
            'US': { longitude: -95.71, latitude: 37.09 },
            'CA': { longitude: -106.35, latitude: 56.13 },
            'JP': { longitude: 138.25, latitude: 36.20 },
            'AU': { longitude: 133.78, latitude: -25.27 },
            'CN': { longitude: 104.20, latitude: 35.86 },
            'IN': { longitude: 78.96, latitude: 20.59 },
            'BR': { longitude: -51.93, latitude: -14.24 },
            'MX': { longitude: -102.55, latitude: 23.63 },
            'KR': { longitude: 127.77, latitude: 35.91 },
            'SG': { longitude: 103.82, latitude: 1.35 },
            'HK': { longitude: 114.11, latitude: 22.40 },
            'ZA': { longitude: 22.94, latitude: -30.56 }
        };
        
        return coordinates[countryId] || null;
    }

    // --- Tab Switching Logic ---
    function initializeTabSwitching() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.getAttribute('data-tab');
                
                // Update active tab button
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                // Update active tab content
                tabContents.forEach(content => content.classList.remove('active'));
                const targetContent = document.getElementById(`${targetTab}-content`);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
                
                // Update current assessment mode
                currentAssessmentMode = targetTab;
                console.log('Switched to:', currentAssessmentMode);
                
                // Manage submit button visibility and step wizard
                const submitBtn = document.querySelector('.wizard-submit');
                if (targetTab === 'full-assessment') {
                    // Hide submit button and initialize step wizard
                    if (submitBtn) submitBtn.classList.add('hide-for-steps');
                    initializeStepWizard();
                } else {
                    // Show submit button and reset step wizard
                    if (submitBtn) submitBtn.classList.remove('hide-for-steps');
                    resetStepWizard();
                }
                
                // Update results title based on current tab
                updateResultsTitle();
                
                // Update required attributes based on active tab
                updateRequiredFields();
            });
        });
    }

    function updateResultsTitle() {
        if (!resultsTitle) return;
        
        if (currentAssessmentMode === 'quick-scan') {
            resultsTitle.textContent = 'Preliminary Results (from Quick Scan):';
        } else {
            resultsTitle.textContent = 'Full Assessment Results:';
        }
    }

    function updateRequiredFields() {
        // Get all form fields
        const quickScanFields = document.querySelectorAll('#quick-scan-content [required]');
        const fullAssessmentFields = document.querySelectorAll('#full-assessment-content [required]');
        
        if (currentAssessmentMode === 'quick-scan') {
            // Enable required for quick scan fields
            quickScanFields.forEach(field => field.setAttribute('required', 'required'));
            // Disable required for full assessment fields
            fullAssessmentFields.forEach(field => field.removeAttribute('required'));
        } else {
            // Disable required for quick scan fields
            quickScanFields.forEach(field => field.removeAttribute('required'));
            // Enable required for full assessment fields
            fullAssessmentFields.forEach(field => field.setAttribute('required', 'required'));
        }
    }

    // --- Step Wizard Functions for Full Assessment ---
    function initializeStepWizard() {
        console.log('Initializing step wizard for full assessment');
        
        const fullAssessmentContent = document.getElementById('full-assessment-content');
        
        // Hide full assessment content initially
        if (fullAssessmentContent) {
            fullAssessmentContent.style.opacity = '0';
            fullAssessmentContent.style.visibility = 'hidden';
        }
        
        // Show loading indicator with appropriate text
        if (loadingIndicator) {
            const loadingText = loadingIndicator.querySelector('p');
            if (loadingText) {
                loadingText.textContent = 'Loading assessment form...';
            }
            loadingIndicator.classList.remove('hidden');
        }
        
        // Reset to first step
        currentStep = 0;
        completedSteps = [];
        
        // Create progress bar and navigation if they don't exist
        createProgressBar();
        createStepNavigation();
        
        // Update progress bar and navigation first
        updateProgressBar();
        updateStepNavigation();
        
        // Initialize all elements first, then show the content
        setTimeout(() => {
            // Re-initialize tagify for full assessment
            if (wizardOperatingCountriesFullInput && Tagify && countryListForDropdown.length > 0) {
                const sortedCountries = [...countryListForDropdown].sort((a, b) => a.name.localeCompare(b.name));
                initializeTagifyFull(sortedCountries);
                // Update whitelist to exclude HQ country if already selected
                updateOperatingCountriesWhitelistFull();
            }
            
            // Show first step (without additional loading since we're already showing it)
            const formGroups = document.querySelectorAll('#full-assessment-content .form-group');
            console.log(`Initializing first step. Found ${formGroups.length} form groups. Current step: ${currentStep}`);
            if (formGroups[currentStep]) {
                console.log(`Adding active class to first form group: ${formGroups[currentStep].querySelector('.group-title')?.textContent}`);
                formGroups[currentStep].classList.add('active');
                
                // Force a reflow to ensure CSS takes effect
                formGroups[currentStep].offsetHeight;
                
                console.log(`First form group active:`, formGroups[currentStep].classList.contains('active'));
            } else {
                console.error(`First form group ${currentStep} not found during initialization!`);
            }
            
            // Show the full assessment content with fade-in effect
            setTimeout(() => {
                if (fullAssessmentContent) {
                    fullAssessmentContent.style.transition = 'opacity 0.4s ease-in-out, visibility 0.4s ease-in-out';
                    fullAssessmentContent.style.opacity = '1';
                    fullAssessmentContent.style.visibility = 'visible';
                }
                
                // Hide loading indicator
                if (loadingIndicator) {
                    loadingIndicator.classList.add('hidden');
                }
            }, 100);
            
        }, 400); // Wait for all elements to be ready
    }
    
    function resetStepWizard() {
        const fullAssessmentContent = document.getElementById('full-assessment-content');
        
        // Reset full assessment content visibility
        if (fullAssessmentContent) {
            fullAssessmentContent.style.opacity = '';
            fullAssessmentContent.style.visibility = '';
            fullAssessmentContent.style.transition = '';
        }
        
        // Hide all form groups 
        const formGroups = document.querySelectorAll('#full-assessment-content .form-group');
        formGroups.forEach(group => {
            group.classList.remove('active');
        });
        
        // Remove step-specific elements
        const progressBar = document.getElementById('assessment-progress-bar');
        const stepNav = document.getElementById('step-navigation');
        if (progressBar) progressBar.remove();
        if (stepNav) stepNav.remove();
        
        // Reset submit button state
        const submitBtn = document.querySelector('.wizard-submit');
        if (submitBtn) {
            submitBtn.classList.remove('hide-for-steps');
            submitBtn.style.display = ''; // Remove inline style to let CSS take control
        }
        
        // Ensure loading indicator is hidden
        if (loadingIndicator) {
            loadingIndicator.classList.add('hidden');
        }
    }
    
    function createProgressBar() {
        const fullAssessmentContent = document.getElementById('full-assessment-content');
        if (!fullAssessmentContent) return;
        
        // Remove existing progress bar
        const existingProgress = document.getElementById('assessment-progress-bar');
        if (existingProgress) existingProgress.remove();
        
        const progressBarHTML = `
            <div id="assessment-progress-bar" class="assessment-progress">
                <div class="progress-container">
                    <div class="progress-fill"></div>
                </div>
                <div class="progress-steps">
                    ${stepNames.map((name, index) => `
                        <div class="progress-step" data-step="${index}">
                            <div class="progress-step-number">${index + 1}</div>
                            <div class="progress-step-label">${name}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        // Insert at the beginning of the form content
        fullAssessmentContent.insertAdjacentHTML('afterbegin', progressBarHTML);
    }
    
    function createStepNavigation() {
        const fullAssessmentContent = document.getElementById('full-assessment-content');
        if (!fullAssessmentContent) return;
        
        // Remove existing navigation
        const existingNav = document.getElementById('step-navigation');
        if (existingNav) existingNav.remove();
        
        const navigationHTML = `
            <div id="step-navigation" class="step-navigation">
                <button type="button" id="prev-step-btn" class="step-nav-button">
                    ← Previous
                </button>
                <button type="button" id="next-step-btn" class="step-nav-button primary">
                    Next →
                </button>
            </div>
        `;
        
        // Insert before the submit button
        const submitBtn = fullAssessmentContent.querySelector('.wizard-submit');
        if (submitBtn) {
            submitBtn.insertAdjacentHTML('beforebegin', navigationHTML);
        } else {
            fullAssessmentContent.insertAdjacentHTML('beforeend', navigationHTML);
        }
        
        // Add event listeners
        const prevBtn = document.getElementById('prev-step-btn');
        const nextBtn = document.getElementById('next-step-btn');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (currentStep > 0) {
                    goToStep(currentStep - 1);
                }
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (validateCurrentStep()) {
                    if (currentStep < totalSteps - 1) {
                        // Mark current step as completed
                        if (!completedSteps.includes(currentStep)) {
                            completedSteps.push(currentStep);
                        }
                        goToStep(currentStep + 1);
                    } else {
                        // Last step - trigger form submission
                        showFinalStep();
                        
                        // If this is the final completion, trigger the form submission
                        setTimeout(() => {
                            const form = document.getElementById('wizard-form');
                            if (form) {
                                form.dispatchEvent(new Event('submit'));
                            }
                        }, 100);
                    }
                }
            });
        }
    }
    
    function showStep(stepIndex) {
        console.log(`showStep called with stepIndex: ${stepIndex}`);
        const fullAssessmentContent = document.getElementById('full-assessment-content');
        
        if (!fullAssessmentContent) {
            console.error('Full assessment content not found!');
            return;
        }
        
        const formGroups = fullAssessmentContent.querySelectorAll('.form-group');
        console.log(`Found ${formGroups.length} form groups`);
        
        // Log current form group titles for debugging
        formGroups.forEach((group, index) => {
            const title = group.querySelector('.group-title');
            console.log(`Form group ${index}: ${title ? title.textContent : 'No title'}`);
        });
        
        // Show loading indicator during step transition (only for navigation between steps)
        const isStepNavigation = Array.from(formGroups).some(group => group.classList.contains('active'));
        console.log(`isStepNavigation: ${isStepNavigation}`);
        
        if (isStepNavigation && loadingIndicator) {
            const loadingText = loadingIndicator.querySelector('p');
            if (loadingText) {
                loadingText.textContent = `Loading ${stepNames[stepIndex]}...`;
            }
            loadingIndicator.classList.remove('hidden');
        }
        
        // Hide all groups first
        formGroups.forEach((group, index) => {
            console.log(`Hiding form group ${index}: ${group.querySelector('.group-title')?.textContent}`);
            group.classList.remove('active');
        });
        
        // Validate step index
        if (stepIndex < 0 || stepIndex >= formGroups.length) {
            console.error(`Invalid step index ${stepIndex}. Valid range: 0-${formGroups.length - 1}`);
            return;
        }
        
        // Show the relevant group for this step with proper loading delay
        const targetGroup = formGroups[stepIndex];
        if (targetGroup) {
            console.log(`Showing form group ${stepIndex}: ${targetGroup.querySelector('.group-title')?.textContent}`);
            const delay = isStepNavigation ? 300 : 0; // Only delay for step navigation, not initial load
            
            setTimeout(() => {
                // If this is the last step (Corporate Structure), ensure tagify is working
                if (stepIndex === 2 && wizardOperatingCountriesFullInput) {
                    console.log('Initializing Tagify for step 2 (Corporate Structure)');
                    // Re-initialize Tagify for the operating countries field if needed
                    if (!tagifyInstanceFull || tagifyInstanceFull.DOM.scope !== wizardOperatingCountriesFullInput) {
                        if (countryListForDropdown.length > 0) {
                            const sortedCountries = [...countryListForDropdown].sort((a, b) => a.name.localeCompare(b.name));
                            initializeTagifyFull(sortedCountries);
                        }
                    }
                    // Update the whitelist to exclude HQ country
                    updateOperatingCountriesWhitelistFull();
                }
                
                // Show the form group
                console.log(`Adding active class to form group ${stepIndex}`);
                targetGroup.classList.add('active');
                
                // Force a reflow to ensure the CSS takes effect
                targetGroup.offsetHeight;
                
                console.log(`Form group ${stepIndex} active class added:`, targetGroup.classList.contains('active'));
                console.log(`Form group ${stepIndex} computed display:`, window.getComputedStyle(targetGroup).display);
                console.log(`Form group ${stepIndex} computed opacity:`, window.getComputedStyle(targetGroup).opacity);
                
                // Hide loading indicator after elements are ready (only if we showed it)
                if (isStepNavigation) {
                    setTimeout(() => {
                        if (loadingIndicator) {
                            loadingIndicator.classList.add('hidden');
                        }
                    }, 200);
                }
                
            }, delay);
        } else {
            console.error(`Form group ${stepIndex} not found! Available groups: ${formGroups.length}`);
        }
    }
    
    function goToStep(stepIndex) {
        if (stepIndex < 0 || stepIndex >= totalSteps) return;
        
        currentStep = stepIndex;
        
        // Update progress bar and navigation immediately
        updateProgressBar();
        updateStepNavigation();
        
        // Show step with loading animation
        showStep(currentStep);
    }
    
    function updateProgressBar() {
        // Update progress fill
        const progressFill = document.querySelector('.progress-fill');
        if (progressFill) {
            const progressPercent = (currentStep / (totalSteps - 1)) * 100;
            progressFill.style.width = `${progressPercent}%`;
        }
        
        // Update step indicators
        const progressSteps = document.querySelectorAll('.progress-step');
        progressSteps.forEach((step, index) => {
            step.classList.remove('active', 'completed');
            
            if (index === currentStep) {
                step.classList.add('active');
            } else if (completedSteps.includes(index) || index < currentStep) {
                step.classList.add('completed');
            }
        });
    }
    
    function updateStepNavigation() {
        const prevBtn = document.getElementById('prev-step-btn');
        const nextBtn = document.getElementById('next-step-btn');
        const submitBtn = document.querySelector('.wizard-submit');
        
        // Update previous button
        if (prevBtn) {
            prevBtn.disabled = currentStep === 0;
        }
        
        // Update next button text
        if (nextBtn) {
            if (currentStep === totalSteps - 1) {
                nextBtn.innerHTML = 'Complete';
                nextBtn.classList.add('primary');
            } else {
                nextBtn.innerHTML = 'Next →';
                nextBtn.classList.remove('primary');
            }
        }
        
        // Keep the submit button hidden in full assessment mode via CSS class
        if (submitBtn && currentAssessmentMode === 'full-assessment') {
            submitBtn.classList.add('hide-for-steps');
            submitBtn.style.display = ''; // Remove any inline styles
        }
        
        // Show step navigation
        const stepNav = document.getElementById('step-navigation');
        if (stepNav) {
            stepNav.style.display = 'flex';
        }
    }
    
    function showFinalStep() {
        // Mark current step as completed
        if (!completedSteps.includes(currentStep)) {
            completedSteps.push(currentStep);
        }
        
        updateProgressBar();
        updateStepNavigation();
    }
    
    function validateCurrentStep() {
        const formGroups = document.querySelectorAll('#full-assessment-content .form-group');
        const currentGroup = formGroups[currentStep];
        
        if (!currentGroup) return true;
        
        // Get all input and select fields in current step (both required and key fields)
        const fields = currentGroup.querySelectorAll('input, select');
        let hasErrors = false;
        let firstErrorField = null;
        
        for (let field of fields) {
            // Skip validation for non-visible conditional fields
            if (field.closest('.conditional-field') && !field.closest('.conditional-field').classList.contains('show')) {
                continue;
            }
            
            // Check if field is required OR if it's a key financial field
            const isRequired = field.hasAttribute('required');
            const isKeyField = field.type === 'number' && (
                field.id === 'wizard-employees-fte' ||
                field.id === 'wizard-turnover' ||
                field.id === 'wizard-assets'
            );
            
            if ((isRequired || isKeyField) && (!field.value || field.value.trim() === '')) {
                // Show validation styling
                field.style.borderColor = '#dc3545';
                field.style.backgroundColor = '#fff5f5';
                
                if (!firstErrorField) {
                    firstErrorField = field;
                }
                hasErrors = true;
                
                // Clear styling after delay
                setTimeout(() => {
                    field.style.borderColor = '';
                    field.style.backgroundColor = '';
                }, 3000);
            }
        }
        
        if (hasErrors) {
            if (firstErrorField) {
                firstErrorField.focus();
            }
            showStepValidationMessage('Please fill in all required fields before proceeding.');
            return false;
        }
        
        return true;
    }
    
    function showValidationMessage(message) {
        // Remove existing message
        const existingMessage = document.getElementById('validation-message');
        if (existingMessage) existingMessage.remove();
        
        // Create new message
        const messageDiv = document.createElement('div');
        messageDiv.id = 'validation-message';
        messageDiv.style.cssText = `
            background-color: #f8d7da;
            color: #721c24;
            padding: 8px 12px;
            border-radius: 4px;
            margin: 10px 0;
            font-size: 0.9rem;
            border: 1px solid #f5c6cb;
            position: relative;
            z-index: 10;
        `;
        messageDiv.textContent = message;
        
        // Insert in appropriate location
        const progressBar = document.getElementById('assessment-progress-bar');
        const wizardForm = document.getElementById('wizard-form');
        
        if (progressBar) {
            // Full assessment mode - insert after progress bar
            progressBar.insertAdjacentElement('afterend', messageDiv);
        } else if (wizardForm) {
            // Quick scan mode - insert at the beginning of form
            wizardForm.insertAdjacentElement('afterbegin', messageDiv);
        }
        
        // Auto-remove after 4 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 4000);
    }
    
    // Alias for backward compatibility
    function showStepValidationMessage(message) {
        showValidationMessage(message);
    }



    function runFullAssessment(data) {
        // Extract and validate full assessment data
        const employeeCount = parseInt(data.employeesFte, 10) || 0;
        const sector = data.sectorFull;
        const hqCountryId = data.hqCountryFull;
        const operatingTags = data.operatingCountriesFull || [];
        const operatingCountryIds = operatingTags.map(tag => tag.id).filter(Boolean);
        
        return {
            employeeCount,
            sector,
            hqCountryId,
            operatingCountryIds,
            turnover: parseFloat(data.turnover) || 0,
            assets: parseFloat(data.assets) || 0,
            listing: data.listing,
            corporateRole: data.corporateRole,
            nonEuTurnover: parseFloat(data.nonEuTurnover) || 0
        };
    }

    // --- Enhanced Assessment Engine ---
    function runFullAssessmentEngine(userProfile, allRegulations) {
        console.log("Running full assessment engine with profile:", userProfile);
        
        const applicableRegulations = [];
        
        // Get list of countries where the company operates
        const relevantCountryIds = [userProfile.hqCountryId, ...userProfile.operatingCountryIds].filter(Boolean);
        console.log("Relevant countries for assessment:", relevantCountryIds);
        
        // Iterate through each regulation only in countries where company operates
        for (const countryId of relevantCountryIds) {
            const countryData = allRegulations[countryId];
            if (!countryData || !countryData.regulations) {
                console.log(`No data found for country: ${countryId}`);
                continue;
            }
            
                        console.log(`Checking regulations for ${countryData.countryName}`);
            
            for (const regulation of countryData.regulations) {
                // Handle regulations without structured criteria using basic logic
                if (!regulation.applicabilityCriteria || !regulation.applicabilityCriteria.rules) {
                    // Use basic applicability logic for regulations without structured criteria
                    if (evaluateBasicRegulationApplicability(regulation, userProfile, countryId, countryData)) {
                        const regulationWithContext = {
                            ...regulation,
                            country: countryData.countryName,
                            countryId: countryId,
                            reason: `Applies in ${countryData.countryName}${userProfile.sector ? ` for ${userProfile.sector} sector` : ''}.`
                        };
                        applicableRegulations.push(regulationWithContext);
                        console.log(`Added regulation (basic logic): ${regulation.name}`);
                    }
                    continue;
                }
                
                console.log(`Evaluating regulation: ${regulation.name}`);
                
                // Check if any rule matches
                let regulationMatches = false;
                
                for (const rule of regulation.applicabilityCriteria.rules) {
                    console.log(`  Checking rule: ${rule.ruleName}`);
                    
                    // Check dependency first
                    if (rule.dependsOn) {
                        const dependentRegulationExists = applicableRegulations.some(
                            reg => reg.name.includes(rule.dependsOn) || rule.dependsOn.includes(reg.name)
                        );
                        if (!dependentRegulationExists) {
                            console.log(`    Dependency not met: ${rule.dependsOn}`);
                            continue;
                        }
                    }
                    
                    // Skip informational or historical rules
                    if (rule.applicabilityType === 'Informational' || rule.applicabilityType === 'Historical') {
                        console.log(`    Skipping ${rule.applicabilityType} rule`);
                        continue;
                    }
                    
                    // Evaluate the rule
                    if (evaluateRule(rule, userProfile)) {
                        console.log(`    Rule matched: ${rule.ruleName}`);
                        regulationMatches = true;
                        break; // One matching rule is enough
                    }
                }
                
                // Add regulation if any rule matched
                if (regulationMatches) {
                    const regulationWithContext = {
                        ...regulation,
                        country: countryData.countryName,
                        countryId: countryId,
                        reason: `Applies based on detailed assessment criteria.`
                    };
                    applicableRegulations.push(regulationWithContext);
                    console.log(`Added regulation: ${regulation.name}`);
                }
            }
        }
        
        // Second pass: handle dependency-based regulations
        console.log("Starting second pass for dependency-based regulations...");
        for (const countryId of relevantCountryIds) {
            const countryData = allRegulations[countryId];
            if (!countryData || !countryData.regulations) continue;
            
            for (const regulation of countryData.regulations) {
                // Skip if already added
                if (applicableRegulations.some(reg => reg.name === regulation.name)) {
                    continue;
                }
                
                // Only process regulations with dependencies
                if (!regulation.applicabilityCriteria || !regulation.applicabilityCriteria.rules) {
                    continue;
                }
                
                console.log(`Second pass - Evaluating regulation: ${regulation.name}`);
                
                let regulationMatches = false;
                
                for (const rule of regulation.applicabilityCriteria.rules) {
                    console.log(`  Second pass - Checking rule: ${rule.ruleName}`);
                    
                    // Skip informational or historical rules
                    if (rule.applicabilityType === 'Informational' || rule.applicabilityType === 'Historical') {
                        console.log(`    Skipping ${rule.applicabilityType} rule`);
                        continue;
                    }
                    
                    // Check dependency (this should work now that first pass is complete)
                    if (rule.dependsOn) {
                        const dependentRegulationExists = applicableRegulations.some(
                            reg => reg.name.includes(rule.dependsOn) || rule.dependsOn.includes(reg.name)
                        );
                        if (!dependentRegulationExists) {
                            console.log(`    Dependency not met: ${rule.dependsOn}`);
                            continue;
                        }
                        console.log(`    Dependency met: ${rule.dependsOn}`);
                        regulationMatches = true;
                        break;
                    }
                }
                
                // Add regulation if dependency was satisfied
                if (regulationMatches) {
                    const regulationWithContext = {
                        ...regulation,
                        country: countryData.countryName,
                        countryId: countryId,
                        reason: `Applies based on dependency criteria.`
                    };
                    applicableRegulations.push(regulationWithContext);
                    console.log(`Added regulation (dependency): ${regulation.name}`);
                }
            }
        }
        
        return applicableRegulations;
    }
    
         function evaluateBasicRegulationApplicability(regulation, userProfile, countryId, countryData) {
         console.log(`  Evaluating basic applicability for: ${regulation.name}`);
         
         // Skip informational, historical, or superseded regulations
         if (regulation.status === 'Replaced by CSRD' || 
             regulation.status === 'Historical' || 
             regulation.status === 'Superseded') {
             console.log(`    Skipping ${regulation.status} regulation`);
             return false;
         }
         
         // Note: Country check is already handled by filtering to relevant countries in the main loop
         
         // Check sector compatibility if specified
         if (regulation.gicsSectors && userProfile.sector) {
             const sectorMatch = regulation.gicsSectors.includes(userProfile.sector);
             if (!sectorMatch) {
                 console.log(`    Sector mismatch: ${userProfile.sector} not in ${regulation.gicsSectors.join(', ')}`);
                 return false;
             }
         }
         
         // For regulations without specific criteria, apply basic size thresholds
         // This ensures larger companies get more regulations flagged
         const isLargeCompany = userProfile.employeeCount >= 250 || 
                               userProfile.turnoverEUR >= 50000000 || 
                               userProfile.assetsEUR >= 25000000;
         
         // Financial regulations typically apply to financial companies regardless of size
         if (regulation.category === 'Reporting' && 
             regulation.name.toLowerCase().includes('financial') && 
             userProfile.sector === 'Financials') {
             console.log(`    Financial regulation applies to financial sector`);
             return true;
         }
         
         // Climate laws typically apply to all companies above a certain size
         if (regulation.category === 'Climate Law' && isLargeCompany) {
             console.log(`    Climate law applies to large company`);
             return true;
         }
         
         // Supply chain due diligence typically applies to larger companies
         if (regulation.category === 'Supply Chain Due Diligence' && 
             (userProfile.employeeCount >= 500 || userProfile.turnoverEUR >= 100000000)) {
             console.log(`    Supply chain regulation applies to large company`);
             return true;
         }
         
         // General reporting requirements for larger companies
         if (regulation.category === 'Reporting' && isLargeCompany) {
             console.log(`    Reporting regulation applies to large company`);
             return true;
         }
         
         console.log(`    Basic criteria not met for ${regulation.name}`);
         return false;
     }

     function evaluateRule(rule, userProfile) {
         console.log(`    Evaluating rule conditions for: ${rule.ruleName}`);
         
         const conditions = [];
         
         // Check sector compatibility
         if (rule.gicsSectors && userProfile.sector) {
             const sectorMatch = rule.gicsSectors.includes(userProfile.sector);
             if (!sectorMatch) {
                 console.log(`      Sector mismatch: ${userProfile.sector} not in ${rule.gicsSectors}`);
                 return false;
             }
             // If sector matches and this is the only criteria, it should pass
             if (!rule.employeeThreshold && !rule.turnoverThresholdEUR && !rule.assetsThresholdEUR && 
                 !rule.isListedOnEURegulatedMarket && !rule.isNonEUParent && !rule.groupTurnoverInEURExceeds) {
                 console.log(`      Sector-only rule passed for ${userProfile.sector}`);
                 return true;
             }
         }
        
        // Check employee threshold
        if (rule.employeeThreshold !== undefined) {
            const employeeMatch = userProfile.employeeCount >= rule.employeeThreshold;
            conditions.push(employeeMatch);
            console.log(`      Employee condition: ${userProfile.employeeCount} >= ${rule.employeeThreshold} = ${employeeMatch}`);
        }
        
        // Check turnover threshold
        if (rule.turnoverThresholdEUR !== undefined) {
            const turnoverMatch = userProfile.turnoverEUR >= rule.turnoverThresholdEUR;
            conditions.push(turnoverMatch);
            console.log(`      Turnover condition: ${userProfile.turnoverEUR} >= ${rule.turnoverThresholdEUR} = ${turnoverMatch}`);
        }
        
        // Check assets threshold
        if (rule.assetsThresholdEUR !== undefined) {
            const assetsMatch = userProfile.assetsEUR >= rule.assetsThresholdEUR;
            conditions.push(assetsMatch);
            console.log(`      Assets condition: ${userProfile.assetsEUR} >= ${rule.assetsThresholdEUR} = ${assetsMatch}`);
        }
        
        // Check listing status
        if (rule.isListedOnEURegulatedMarket !== undefined) {
            const listingMatch = userProfile.isListedOnEURegulatedMarket === rule.isListedOnEURegulatedMarket;
            conditions.push(listingMatch);
            console.log(`      Listing condition: ${userProfile.isListedOnEURegulatedMarket} === ${rule.isListedOnEURegulatedMarket} = ${listingMatch}`);
        }
        
        // Check non-EU parent status
        if (rule.isNonEUParent !== undefined) {
            const nonEuMatch = userProfile.isNonEUParent === rule.isNonEUParent;
            conditions.push(nonEuMatch);
            console.log(`      Non-EU parent condition: ${userProfile.isNonEUParent} === ${rule.isNonEUParent} = ${nonEuMatch}`);
        }
        
        // Check group turnover in EU
        if (rule.groupTurnoverInEURExceeds !== undefined) {
            const groupTurnoverMatch = userProfile.groupTurnoverInEUR >= rule.groupTurnoverInEURExceeds;
            conditions.push(groupTurnoverMatch);
            console.log(`      Group EU turnover condition: ${userProfile.groupTurnoverInEUR} >= ${rule.groupTurnoverInEURExceeds} = ${groupTurnoverMatch}`);
        }
        
        // Handle financial combination rule (for complex cases like Swiss regulations)
        if (rule.financialCombinationRule) {
            const financialMatch = evaluateFinancialCombinationRule(rule.financialCombinationRule, userProfile);
            conditions.push(financialMatch);
            console.log(`      Financial combination rule result: ${financialMatch}`);
        }
        
        // Apply combination logic
        const combinationRule = rule.combinationRule || 'all';
        let ruleResult = false;
        
        if (combinationRule === '2_of_3') {
            // For 2_of_3, we only consider the first 3 conditions (employee, turnover, assets)
            const mainConditions = conditions.slice(0, 3);
            const matchCount = mainConditions.filter(Boolean).length;
            ruleResult = matchCount >= 2;
            console.log(`      2_of_3 rule: ${matchCount}/3 conditions met = ${ruleResult}`);
        } else if (combinationRule === 'all') {
            ruleResult = conditions.length > 0 && conditions.every(Boolean);
            console.log(`      All rule: ${conditions.filter(Boolean).length}/${conditions.length} conditions met = ${ruleResult}`);
        } else if (combinationRule === 'any') {
            ruleResult = conditions.some(Boolean);
            console.log(`      Any rule: ${conditions.filter(Boolean).length}/${conditions.length} conditions met = ${ruleResult}`);
        }
        
        return ruleResult;
    }
    
    function evaluateFinancialCombinationRule(financialRule, userProfile) {
        if (financialRule.rule === '1_of_2') {
            const turnoverMatch = userProfile.turnoverEUR >= (financialRule.turnoverThresholdEUR || 0);
            const assetsMatch = userProfile.assetsEUR >= (financialRule.assetsThresholdEUR || 0);
            return turnoverMatch || assetsMatch;
        }
        return false;
    }
    
    function createUserProfileFromFormData(formData, isQuickScan = false) {
        if (isQuickScan) {
            // Quick scan profile (simplified)
            const operatingCountryIds = formData.operatingCountryIds || [];
            const allCountryIds = [formData.hqCountryId, ...operatingCountryIds].filter(Boolean);
            
            return {
                employeeCount: formData.employeeCount || 0,
                sector: formData.sector ? formData.sector.split('-').map(word => 
                    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ') : null,
                hqCountryId: formData.hqCountryId,
                operatingCountryIds: operatingCountryIds,
                isEUCompany: allCountryIds.some(id => europeanUnionIds.includes(id)),
                // Simplified assumptions for quick scan
                turnoverEUR: 0,
                assetsEUR: 0,
                isListedOnEURegulatedMarket: false,
                isNonEUParent: false,
                groupTurnoverInEUR: 0
            };
        }
        
        // Full assessment profile
        const operatingTags = formData.operatingCountriesFull || [];
        const operatingCountryIds = operatingTags.map(tag => tag.id).filter(Boolean);
        const allCountryIds = [formData.hqCountryFull, ...operatingCountryIds].filter(Boolean);
        const isEUHq = europeanUnionIds.includes(formData.hqCountryFull);
        const hasEUOperations = operatingCountryIds.some(id => europeanUnionIds.includes(id));
        
                 return {
             employeeCount: formData.employeesFte || 0,
             sector: formData.sectorFull ? formData.sectorFull.split('-').map(word => 
                 word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ') : null,
             hqCountryId: formData.hqCountryFull,
             operatingCountryIds: operatingCountryIds,
             isEUCompany: isEUHq || hasEUOperations,
             turnoverEUR: formData.turnover || 0,
             assetsEUR: formData.assets || 0,
             isListedOnEURegulatedMarket: formData.listing === 'eu-listed',
             isNonEUParent: !isEUHq,
             groupTurnoverInEUR: formData.nonEuTurnover || 0,
             corporateRole: formData.corporateRole
         };
     }

     // --- Regulation Expansion Functions ---
     function createApplicabilityContent(regulation, countryName) {
         const container = document.createElement('div');
         container.className = 'applicability-details';
         
         const title = document.createElement('h6');
         title.className = 'applicability-title';
         title.textContent = 'Why This Regulation May Apply';
         container.appendChild(title);
         
         if (regulation.applicabilityCriteria) {
             // Show structured applicability criteria
             const criteriaContainer = document.createElement('div');
             criteriaContainer.className = 'criteria-container';
             
             if (regulation.applicabilityCriteria.notes) {
                 const notes = document.createElement('p');
                 notes.className = 'criteria-notes';
                 notes.textContent = regulation.applicabilityCriteria.notes;
                 criteriaContainer.appendChild(notes);
             }
             
             if (regulation.applicabilityCriteria.rules && regulation.applicabilityCriteria.rules.length > 0) {
                 const rulesTitle = document.createElement('h6');
                 rulesTitle.className = 'rules-title';
                 rulesTitle.textContent = 'Applicability Rules:';
                 criteriaContainer.appendChild(rulesTitle);
                 
                 const rulesList = document.createElement('ul');
                 rulesList.className = 'rules-list';
                 
                 regulation.applicabilityCriteria.rules.forEach(rule => {
                     if (rule.applicabilityType === 'Informational' || rule.applicabilityType === 'Historical') {
                         return; // Skip these rules
                     }
                     
                     const ruleItem = document.createElement('li');
                     ruleItem.className = 'rule-item';
                     
                     const ruleHeader = document.createElement('div');
                     ruleHeader.className = 'rule-header';
                     ruleHeader.textContent = rule.ruleName || 'Applicability Rule';
                     
                     const ruleDescription = document.createElement('div');
                     ruleDescription.className = 'rule-description';
                     ruleDescription.textContent = rule.description || '';
                     
                     const ruleConditions = document.createElement('div');
                     ruleConditions.className = 'rule-conditions';
                     
                     // Show specific conditions with proper handling of financial combination rules
                     const conditions = [];
                     
                     // Handle employee threshold
                     if (rule.employeeThreshold) {
                         conditions.push(`Employees: ≥${rule.employeeThreshold.toLocaleString()}`);
                     }
                     
                     // Handle financial combination rule if present
                     if (rule.financialCombinationRule) {
                         const financialRule = rule.financialCombinationRule;
                         const financialConditions = [];
                         
                         if (financialRule.turnoverThresholdEUR) {
                             financialConditions.push(`€${(financialRule.turnoverThresholdEUR / 1000000).toFixed(0)}M turnover`);
                         }
                         if (financialRule.assetsThresholdEUR) {
                             financialConditions.push(`€${(financialRule.assetsThresholdEUR / 1000000).toFixed(0)}M assets`);
                         }
                         
                         if (financialConditions.length > 0) {
                             if (financialRule.rule === '1_of_2') {
                                 conditions.push(`Financial: ${financialConditions.join(' OR ')} (1 of ${financialConditions.length} required)`);
                             } else {
                                 conditions.push(`Financial: ${financialConditions.join(' AND ')}`);
                             }
                         }
                     } else {
                         // Handle regular turnover/assets thresholds (when not part of combination rule)
                     if (rule.turnoverThresholdEUR) {
                         conditions.push(`Turnover: ≥€${(rule.turnoverThresholdEUR / 1000000).toFixed(0)}M`);
                     }
                     if (rule.assetsThresholdEUR) {
                         conditions.push(`Assets: ≥€${(rule.assetsThresholdEUR / 1000000).toFixed(0)}M`);
                     }
                     }
                     
                     // Handle other conditions
                     if (rule.isListedOnEURegulatedMarket) {
                         conditions.push('Listed on EU regulated market');
                     }
                     if (rule.gicsSectors && rule.gicsSectors.length > 0) {
                         conditions.push(`Sectors: ${rule.gicsSectors.join(', ')}`);
                     }
                     if (rule.dependsOn) {
                         conditions.push(`Depends on: ${rule.dependsOn}`);
                     }
                     
                     if (conditions.length > 0) {
                         ruleConditions.innerHTML = `<strong>Conditions:</strong><br/>${conditions.map(cond => `- ${cond}`).join('<br/>')}`;
                     }
                     
                     // Show combination rule with better descriptions
                     if (rule.combinationRule) {
                         const combinationInfo = document.createElement('div');
                         combinationInfo.className = 'combination-rule';
                         
                         if (rule.combinationRule === '2_of_3') {
                             combinationInfo.innerHTML = '<strong>Rule:</strong> At least 2 of the 3 main criteria (employees, turnover, assets) must be met';
                         } else if (rule.combinationRule === 'all') {
                             // Provide more context for "all" rules
                             if (rule.financialCombinationRule) {
                                 combinationInfo.innerHTML = '<strong>Rule:</strong> Employee threshold AND at least one financial criterion must be met';
                             } else {
                             combinationInfo.innerHTML = '<strong>Rule:</strong> All specified conditions must be met';
                             }
                         } else if (rule.combinationRule === 'any') {
                             combinationInfo.innerHTML = '<strong>Rule:</strong> Any one of the specified conditions must be met';
                         }
                         
                         ruleConditions.appendChild(combinationInfo);
                     }
                     
                     ruleItem.appendChild(ruleHeader);
                     ruleItem.appendChild(ruleDescription);
                     if (conditions.length > 0 || rule.combinationRule) {
                         ruleItem.appendChild(ruleConditions);
                     }
                     
                     rulesList.appendChild(ruleItem);
                 });
                 
                 criteriaContainer.appendChild(rulesList);
             }
             
             container.appendChild(criteriaContainer);
         } else {
             // Show basic information for regulations without structured criteria
             const basicInfo = document.createElement('div');
             basicInfo.className = 'basic-applicability';
             basicInfo.innerHTML = `
                 <p>This regulation applies in <strong>${countryName}</strong>.</p>
                 <p>For detailed applicability criteria, please consult the official regulation text or seek professional advice.</p>
             `;
             container.appendChild(basicInfo);
         }
         
         // Add assessment note
         const assessmentNote = document.createElement('div');
         assessmentNote.className = 'assessment-note';
         assessmentNote.innerHTML = `
             <p><em><strong>Note:</strong> This is a preliminary assessment. Actual applicability may depend on additional factors not captured here. 
             Always consult legal professionals for definitive compliance advice.</em></p>
         `;
         container.appendChild(assessmentNote);
         
         return container;
     }
     
     function toggleRegulationExpansion(regulationItem) {
         const expandableSection = regulationItem.querySelector('.regulation-expandable');
         const expandIcon = regulationItem.querySelector('.expand-icon');
         
         if (!expandableSection || !expandIcon) return;
         
         const isExpanded = !expandableSection.classList.contains('hidden');
         
         if (isExpanded) {
             // Collapse
             expandableSection.classList.add('hidden');
             expandIcon.textContent = '▼';
             regulationItem.classList.remove('expanded');
         } else {
             // Expand
             expandableSection.classList.remove('hidden');
             expandIcon.textContent = '▲';
             regulationItem.classList.add('expanded');
         }
     }

    // --- Enhanced Wizard Logic ---
    function runWizardCheck(data) {
        console.log("Running wizard check:", data);
        wizardResultsDiv?.classList.add('hidden');
        viewCountryDetailsBtn?.classList.add('hidden');

        let applicableRegulations = [];
        
        if (currentAssessmentMode === 'full-assessment') {
            // Use new structured assessment engine
            const userProfile = createUserProfileFromFormData(data, false);
            console.log("Created user profile for full assessment:", userProfile);
            
            applicableRegulations = runFullAssessmentEngine(userProfile, esgData);
            
            // Deduplicate regulations from the structured assessment
            applicableRegulations = deduplicateRegulations(applicableRegulations, userProfile.sector);
        } else {
            // Use simplified quick scan logic
            const userProfile = createUserProfileFromFormData(data, true);
            console.log("Created user profile for quick scan:", userProfile);
            
            applicableRegulations = runQuickScanAssessment(userProfile);
        }
        
    function runQuickScanAssessment(userProfile) {
        const applicableRegulations = [];
        const { employeeCount, sector, hqCountryId, operatingCountryIds, isEUCompany } = userProfile;
        const allSelectedIds = [hqCountryId, ...operatingCountryIds].filter(Boolean);
        const largeCompanyThreshold = 250; 
        const veryLargeCompanyThreshold = 500;

        console.log("Running quick scan assessment for:", { employeeCount, sector, isEUCompany });

        // Simple CSRD check
        let csrdApplies = employeeCount >= largeCompanyThreshold && isEUCompany;
        
        if (csrdApplies) { 
            // Find CSRD regulation from any EU country in our data
            const csrdReg = findRegulationInData("Corporate Sustainability Reporting Directive", "CSRD", sector);
            if (csrdReg) {
                applicableRegulations.push({
                    ...csrdReg,
                    reason: `Likely applies due to size (>=${largeCompanyThreshold} employees) and EU presence.`
                });
            }
        }
        
        if (csrdApplies) { 
            // Find EU Taxonomy regulation
            const taxonomyReg = findRegulationInData("EU Taxonomy Regulation", "Taxonomy", sector);
            if (taxonomyReg) {
                applicableRegulations.push({
                    ...taxonomyReg,
                    reason: `Applies to companies subject to CSRD reporting requirements.`
                });
            }
        }

        if (employeeCount >= veryLargeCompanyThreshold && isEUCompany) {
            // Find CSDDD regulation
            const csdddReg = findRegulationInData("Corporate Sustainability Due Diligence Directive", "CSDDD", sector);
            if (csdddReg) {
                applicableRegulations.push({
                    ...csdddReg,
                    reason: `Likely applies due to size (>=${veryLargeCompanyThreshold} employees) and EU operations.`
                });
            }
        }

        // Check for Financial Services regulations (SFDR)
        if (sector === "Financials" && isEUCompany) {
            const sfdrReg = findRegulationInData("Sustainable Finance Disclosure Regulation", "SFDR", sector);
            if (sfdrReg) {
                applicableRegulations.push({
                    ...sfdrReg,
                    reason: `Applies to financial market participants in the EU.`
                });
            }
        }

        // Check country-specific regulations (simplified)
        allSelectedIds.forEach(countryId => {
            const countryData = esgData[countryId];
            if (countryData?.regulations) {
                countryData.regulations.forEach(reg => {
                    console.log(`Checking regulation: ${reg.name}, sectors: ${JSON.stringify(reg.gicsSectors)}, selected: ${sector}`);
                    
                    // Skip regulations already found (avoid duplicates)
                    const alreadyExists = applicableRegulations.some(existing => existing.name === reg.name);
                    if (alreadyExists) {
                        console.log(`Skipping ${reg.name} - already included`);
                        return;
                    }
                    
                    // Check if regulation applies to the selected sector (if sector is specified)
                    if (sector && reg.gicsSectors && !reg.gicsSectors.includes(sector)) {
                        console.log(`Skipping ${reg.name} - sector mismatch`);
                        return;
                    }
                    
                    // Check if regulation might apply - be inclusive unless we can definitively exclude
                    let applies = false;
                    let canEvaluate = true;
                    let reason = '';
                    
                    if (reg.applicabilityCriteria && reg.applicabilityCriteria.rules) {
                        // For structured criteria, do basic checks we can evaluate
                        let mightApply = false;
                        let definitelyDoesNotApply = false;
                        
                        for (const rule of reg.applicabilityCriteria.rules) {
                            // Skip informational rules
                            if (rule.applicabilityType === 'Informational' || rule.applicabilityType === 'Historical') {
                                continue;
                            }
                            
                            // Check employee threshold if specified
                            if (rule.employeeThreshold !== undefined) {
                                if (employeeCount >= rule.employeeThreshold) {
                                    mightApply = true;
                                } else {
                                    // If employee count is definitely too low for any rule, exclude
                                    const allRulesHaveHigherThreshold = reg.applicabilityCriteria.rules
                                        .filter(r => r.applicabilityType !== 'Informational' && r.applicabilityType !== 'Historical')
                                        .every(r => r.employeeThreshold && employeeCount < r.employeeThreshold);
                                    if (allRulesHaveHigherThreshold) {
                                        definitelyDoesNotApply = true;
                                        reason = `Employee count (${employeeCount}) below minimum threshold`;
                                        break;
                                    }
                                }
                            } else {
                                // No employee threshold specified, might apply
                                mightApply = true;
                            }
                        }
                        
                        if (definitelyDoesNotApply) {
                            applies = false;
                        } else if (mightApply) {
                            applies = true;
                            reason = `May apply based on company profile - detailed assessment recommended`;
                        } else {
                            // No clear determination possible, include it
                            applies = true;
                            reason = `Potential applicability - detailed assessment needed`;
                        }
                    } else {
                        // Apply simple size-based logic for regulations without structured criteria
                        if (reg.name.toLowerCase().includes('lieferketten') || 
                            reg.name.toLowerCase().includes('supply chain') ||
                            reg.name.toLowerCase().includes('due diligence')) {
                            // Supply chain laws typically apply to larger companies
                            applies = employeeCount >= 1000;
                            reason = applies ? 
                                `Likely applies based on company size (${employeeCount} employees)` :
                                `May not apply - typically requires ≥1,000 employees`;
                        } else if (reg.category === 'Reporting') {
                            // General reporting requirements
                            applies = employeeCount >= 250;
                            reason = applies ? 
                                `Likely applies based on company size (${employeeCount} employees)` :
                                `May not apply - typically requires ≥250 employees`;
                        } else if (reg.category === 'Climate Law') {
                            // Climate laws often have broader applicability
                            applies = employeeCount >= 50; // More inclusive for climate laws
                            reason = `May apply based on company operations`;
                        } else {
                            // Default: include unless obviously too small
                            applies = employeeCount >= 50;
                            reason = `Potential applicability based on company profile`;
                        }
                    }

                    if (applies) {
                    // Add regulation with country info
                    applicableRegulations.push({
                        ...reg,
                        country: countryData.countryName,
                        countryId: countryId,
                            reason: reason || `Applies in ${countryData.countryName}${sector ? ` for ${sector} sector` : ''}.`
                    });
                        console.log(`Added regulation: ${reg.name} - ${reason}`);
                    } else {
                        console.log(`Skipping ${reg.name} - ${reason || 'size threshold not met'}`);
                    }
                });
            }
        });

                 return applicableRegulations;
     }

        console.log("Final applicable regulations:", applicableRegulations);

        // Store regulations for category matching
        currentApplicableRegulations = applicableRegulations;

        // Display results in regulation format
        displayWizardResults(applicableRegulations);
        
        // Display regulation categories summary
        displayRegulationCategories(applicableRegulations);

        // Show and create mini globe
        const miniGlobeContainer = document.getElementById('mini-globe-container');
        if (miniGlobeContainer) {
            miniGlobeContainer.classList.remove('hidden');
        }

        // Show regulation categories
        const regulationCategories = document.getElementById('regulation-categories');
        if (regulationCategories) {
            regulationCategories.classList.remove('hidden');
        }

        // Get country IDs based on assessment mode
        const hqCountryId = currentAssessmentMode === 'quick-scan' ? data.hqCountryId : data.hqCountryFull;
        const operatingCountryIds = currentAssessmentMode === 'quick-scan' ? 
            data.operatingCountryIds : 
            (data.operatingCountriesFull ? data.operatingCountriesFull.map(tag => tag.id).filter(Boolean) : []);

        // Create and highlight mini globe
        setTimeout(() => {
            createMiniGlobe();
            setTimeout(() => {
                highlightMiniGlobeCountries(hqCountryId, operatingCountryIds);
            }, 500);
        }, 100);

        // Prepare data for carousel and highlighting
        carouselCountries = [];
            
        if (hqCountryId) { const hq = countryListForDropdown.find(c => c.id === hqCountryId); if(hq) carouselCountries.push({ ...hq, isHQ: true }); }
        operatingCountryIds.forEach(id => { if (id !== hqCountryId) { const op = countryListForDropdown.find(c => c.id === id); if (op) carouselCountries.push({ ...op, isHQ: false }); } });

        if (carouselCountries.length > 0) {
             highlightWizardCountries(hqCountryId, operatingCountryIds);
             viewCountryDetailsBtn?.classList.remove('hidden');
             backToFormBtn?.classList.remove('hidden');
        } else { clearMultiCountryHighlights();
             backToFormBtn?.classList.add('hidden');
        }
    }

    // New function to deduplicate regulations and combine countries
    function deduplicateRegulations(regulations, normalizedSector) {
        const regulationMap = new Map();

        regulations.forEach(reg => {
            const key = reg.name; // Use regulation name as the key
            
            if (regulationMap.has(key)) {
                // Regulation already exists, add country to the list
                const existingReg = regulationMap.get(key);
                if (!existingReg.countries.includes(reg.country)) {
                    existingReg.countries.push(reg.country);
                    existingReg.countryIds.push(reg.countryId);
                }
            } else {
                // New regulation, create entry
                regulationMap.set(key, {
                    ...reg,
                    countries: [reg.country],
                    countryIds: [reg.countryId]
                });
            }
        });

        // Convert map back to array and update reason text
        return Array.from(regulationMap.values()).map(reg => {
            if (reg.countries.length > 1) {
                // Multiple countries
                const countryList = reg.countries.join(' and ');
                reg.reason = `Applies in ${countryList}${normalizedSector ? ` for ${normalizedSector} sector` : ''}.`;
            }
            return reg;
        });
    }

    function displayRegulationCategories(regulations) {
        const categoriesList = document.getElementById('categories-list');
        if (!categoriesList) return;

        // Clear previous results
        categoriesList.innerHTML = '';

        if (regulations.length === 0) {
            const noCategories = document.createElement('div');
            noCategories.className = 'category-item other';
            noCategories.innerHTML = `
                <div class="category-icon">❌</div>
                <div class="category-count">0</div>
                <div class="category-name">No regulations found</div>
            `;
            categoriesList.appendChild(noCategories);
            return;
        }

        // Count regulations by category
        const categoryCounts = {};
        regulations.forEach(reg => {
            const category = reg.category || 'Other';
            categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        });

        // Create category items
        Object.entries(categoryCounts).forEach(([category, count]) => {
            const categoryItem = document.createElement('div');
            categoryItem.className = `category-item ${getCategoryClass(category)}`;
            categoryItem.dataset.category = category; // Add data attribute for event handling
            
            const icon = getCategoryIcon(category);
            
            categoryItem.innerHTML = `
                <div class="category-icon">${icon}</div>
                <div class="category-count">${count}</div>
                <div class="category-name">${category}</div>
            `;
            
            // Add click event listener for highlighting
            categoryItem.addEventListener('click', function() {
                highlightRegulationsByCategory(category, categoryItem);
            });
            
            categoriesList.appendChild(categoryItem);
        });
    }

    function getCategoryClass(category) {
        const categoryLower = category.toLowerCase();
        if (categoryLower.includes('reporting')) return 'reporting';
        if (categoryLower.includes('supply chain') || categoryLower.includes('due diligence')) return 'supply-chain';
        if (categoryLower.includes('climate') || categoryLower.includes('environmental')) return 'climate';
        if (categoryLower.includes('financial') || categoryLower.includes('finance')) return 'financial';
        return 'other';
    }

    function getCategoryIcon(category) {
        const categoryLower = category.toLowerCase();
        if (categoryLower.includes('reporting')) return '📊';
        if (categoryLower.includes('supply chain') || categoryLower.includes('due diligence')) return '🔗';
        if (categoryLower.includes('climate') || categoryLower.includes('environmental')) return '🌱';
        if (categoryLower.includes('financial') || categoryLower.includes('finance')) return '💰';
        if (categoryLower.includes('taxonomy')) return '🏷️';
        if (categoryLower.includes('disclosure')) return '📋';
        return '📄';
    }

    // Enhanced function to find regulations with sector filtering
    function findRegulationInData(searchName, searchAlias, selectedSector) {
        for (const countryId in esgData) {
            const countryData = esgData[countryId];
            if (countryData?.regulations) {
                for (const reg of countryData.regulations) {
                    const nameMatch = reg.name.toLowerCase().includes(searchName.toLowerCase()) || 
                                    reg.name.toLowerCase().includes(searchAlias.toLowerCase());
                    
                    // Check sector compatibility if a sector is selected
                    const sectorMatch = !selectedSector || 
                                      !reg.gicsSectors || 
                                      reg.gicsSectors.includes(selectedSector);
                    
                    if (nameMatch && sectorMatch) {
                        return {
                            ...reg,
                            country: countryData.countryName,
                            countryId: countryId
                        };
                    }
                }
            }
        }
        return null;
    }

    // Updated function to display wizard results with better styling
    function displayWizardResults(regulations) {
        if (!wizardResultsList) return;

        // Clear previous results
        wizardResultsList.innerHTML = '';

        if (regulations.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'no-regulations-message';
            noResults.innerHTML = `
                <div class="no-results-icon">📋</div>
                <p>No specific regulations found for your profile.</p>
                <p class="no-results-subtitle">Consider consulting local authorities for comprehensive requirements.</p>
            `;
            wizardResultsList.appendChild(noResults);
            return;
        }

        regulations.forEach((reg, index) => {
            const item = document.createElement('div');
            item.className = 'regulation-item expandable';
            item.dataset.category = reg.category || 'Other'; // Add data attribute for easier filtering
            
            const iconContainer = document.createElement('div');
            iconContainer.className = 'regulation-icon-container';
            
            const icon = document.createElement('span');
            icon.className = 'regulation-icon';
            
            // Determine icon and color based on status
            if (reg.status === 'Enacted') {
                icon.textContent = '✓';
                icon.style.color = '#28a745';
                iconContainer.style.backgroundColor = '#e8f5e8';
            } else if (reg.status === 'Adopted' || reg.status.includes('Adopted')) {
                icon.textContent = '⏳';
                icon.style.color = '#ffc107';
                iconContainer.style.backgroundColor = '#fff8e1';
            } else if (reg.status === 'Proposed') {
                icon.textContent = '📋';
                icon.style.color = '#6c757d';
                iconContainer.style.backgroundColor = '#f8f9fa';
            } else {
                icon.textContent = '📄';
                icon.style.color = '#007bff';
                iconContainer.style.backgroundColor = '#e3f2fd';
            }
            
            iconContainer.appendChild(icon);
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'regulation-content';
            
            const headerDiv = document.createElement('div');
            headerDiv.className = 'regulation-header';
            
            const title = document.createElement('h6');
            title.className = 'regulation-title';
            title.textContent = reg.name;
            
            const expandIcon = document.createElement('span');
            expandIcon.className = 'expand-icon';
            expandIcon.textContent = '▼';
            
            const statusBadge = document.createElement('span');
            statusBadge.className = `status-badge status-${reg.status?.toLowerCase().replace(/\s+/g, '-') || 'unknown'}`;
            statusBadge.textContent = reg.status || 'Unknown';
            
            const yearBadge = document.createElement('span');
            yearBadge.className = 'year-badge';
            yearBadge.textContent = reg.year || 'N/A';
            
            headerDiv.appendChild(title);
            headerDiv.appendChild(expandIcon);
            headerDiv.appendChild(statusBadge);
            headerDiv.appendChild(yearBadge);
            
            const description = document.createElement('p');
            description.className = 'regulation-description';
            description.textContent = reg.description || 'No description available.';
            
            const applicabilityDiv = document.createElement('div');
            applicabilityDiv.className = 'regulation-applicability';
            
            const applicabilityText = document.createElement('span');
            applicabilityText.textContent = reg.reason || 'Applicable based on company profile.';
            
            applicabilityDiv.appendChild(applicabilityText);
            
            contentDiv.appendChild(headerDiv);
            contentDiv.appendChild(description);
            contentDiv.appendChild(applicabilityDiv);
            
            // Create main content wrapper
            const mainContent = document.createElement('div');
            mainContent.className = 'regulation-main-content';
            mainContent.appendChild(iconContainer);
            mainContent.appendChild(contentDiv);
            
            // Create expandable section
            const expandableSection = document.createElement('div');
            expandableSection.className = 'regulation-expandable hidden';
            
            // Add applicability information if available
            // For wizard results, we need to determine the country name
            const countryName = reg.country || (reg.countries && reg.countries.length > 0 ? reg.countries.join(' and ') : 'Unknown');
            const applicabilityContent = createApplicabilityContent(reg, countryName);
            expandableSection.appendChild(applicabilityContent);
            
            item.appendChild(mainContent);
            item.appendChild(expandableSection);
            
            // Add click event listener for expansion
            item.addEventListener('click', () => toggleRegulationExpansion(item));
            
            wizardResultsList.appendChild(item);
        });
    }

    // Updated function to highlight regulations by category with better deselection
    function highlightRegulationsByCategory(selectedCategory, clickedCategoryItem) {
        const regulationItems = document.querySelectorAll('.regulation-item');
        const categoryItems = document.querySelectorAll('.category-item');
        
        // Check if this category is already selected (toggle off)
        const isAlreadySelected = clickedCategoryItem.classList.contains('active');
        
        // Remove active state from all category items
        categoryItems.forEach(item => item.classList.remove('active'));
        
        if (isAlreadySelected) {
            // Clear all highlights if clicking the same category again
            regulationItems.forEach(item => {
                item.classList.remove('highlighted', 'dimmed');
            });
            return;
        }
        
        // Add active state to clicked category
        clickedCategoryItem.classList.add('active');
        
        // Find regulations that match the selected category
        regulationItems.forEach((item) => {
            const itemCategory = item.dataset.category || 'Other';
            
            if (itemCategory === selectedCategory) {
                item.classList.add('highlighted');
                item.classList.remove('dimmed');
            } else {
                item.classList.remove('highlighted');
                item.classList.add('dimmed');
            }
        });
        
        // Scroll to the first highlighted regulation
        const firstHighlighted = document.querySelector('.regulation-item.highlighted');
        if (firstHighlighted) {
            firstHighlighted.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'nearest' 
            });
        }
    }

    // Helper function to store current regulations for category matching
    let currentApplicableRegulations = [];

    function getCurrentApplicableRegulations() {
        return currentApplicableRegulations;
    }

    // --- Event Listeners ---
    function handleBackToWizard() {
        // This function is now deprecated - all back buttons should use handleBackToMainView
        handleBackToMainView();
    }

    function handleBackToMainView() {
        // Reset everything to initial state
        carouselCountries = []; currentCarouselIndex = -1;
        
        // Hide all result elements
        wizardResultsDiv?.classList.add('fade-out');
        
        setTimeout(() => {
            wizardResultsDiv?.classList.add('no-display', 'hidden');
            wizardResultsDiv?.classList.remove('fade-out');
            
            // Remove full-width class and show header again
            countryDataContainer?.classList.remove('full-width');
            wizardView?.classList.remove('showing-results');
            
            // Hide wizard top back button
            wizardTopBackBtn?.classList.add('hidden');
            
            // Hide mini globe and categories
            const topRow = document.getElementById('top-row');
            if (topRow) {
                topRow.classList.add('hidden');
                topRow.style.display = 'none';
            }
            
            // Show the main globe container again
            const globeContainer = document.getElementById('globe-full');
            if (globeContainer) {
                globeContainer.style.display = 'block';
            }
            
            // Dispose mini globe
            if (miniGlobe && !miniGlobe.isDisposed()) {
                miniGlobe.dispose();
                miniGlobe = null;
            }
            
            // Show form again
            wizardForm?.classList.remove('no-display');
            wizardForm?.classList.add('fade-in');
            
                    // Clear highlights
        clearMultiCountryHighlights();
        
        // Set the panel state to wizard to ensure proper view
        setPanelState('wizard');
        
        setTimeout(() => {
            wizardForm?.classList.remove('fade-in');
        }, 500);
        }, 500);
    }

    backToWizardBtn?.addEventListener('click', handleBackToMainView);
    topBackBtn?.addEventListener('click', handleBackToMainView);
    wizardTopBackBtn?.addEventListener('click', handleBackToMainView);
    
    // Back to form button (in wizard results) should also go back to main view
    backToFormBtn?.addEventListener('click', handleBackToMainView);

    wizardForm?.addEventListener('submit', function(event) {
        event.preventDefault();

        // Check if we're in full assessment mode and not on the final step
        if (currentAssessmentMode === 'full-assessment' && 
            (currentStep < totalSteps - 1 || completedSteps.length < totalSteps - 1)) {
            console.log('Cannot submit - full assessment not completed');
            showStepValidationMessage('Please complete all steps before submitting.');
            return;
        }

        // --- Get form data based on current tab ---
        let formData;
        
        if (currentAssessmentMode === 'quick-scan') {
            const employees = parseInt(wizardEmployeesInput.value, 10) || 0;
            const sector = wizardSectorSelect.value;
            const hqId = wizardHqCountrySelect.value;
            const operatingTags = tagifyInstance ? tagifyInstance.value : [];
            const opIds = operatingTags.map(tag => tag.id).filter(Boolean);

            if (!hqId) { 
                showValidationMessage("Please fill in all required fields before proceeding.");
                wizardHqCountrySelect.focus();
                return; 
            }

            formData = {
                employeeCount: employees,
                sector: sector,
                hqCountryId: hqId,
                operatingCountryIds: opIds
            };
        } else {
            // Full assessment data - final validation
            const employeesFte = parseInt(wizardEmployeesFteInput.value, 10) || 0;
            const sectorFull = wizardSectorFullSelect.value;
            const hqIdFull = wizardHqCountryFullSelect.value;
            const operatingTagsFull = tagifyInstanceFull ? tagifyInstanceFull.value : [];
            const turnover = parseFloat(wizardTurnoverInput.value) || 0;
            const assets = parseFloat(wizardAssetsInput.value) || 0;
            const listing = wizardListingSelect.value;
            const corporateRole = wizardCorporateRoleSelect.value;
            const nonEuTurnover = parseFloat(wizardNonEuTurnoverInput.value) || 0;

            if (!hqIdFull) { 
                showValidationMessage("Please fill in all required fields before proceeding.");
                wizardHqCountryFullSelect.focus();
                return; 
            }

            formData = {
                employeesFte: employeesFte,
                sectorFull: sectorFull,
                hqCountryFull: hqIdFull,
                operatingCountriesFull: operatingTagsFull,
                turnover: turnover,
                assets: assets,
                listing: listing,
                corporateRole: corporateRole,
                nonEuTurnover: nonEuTurnover
            };
        }

        // Show loading indicator immediately with appropriate text
        if (loadingIndicator) {
            const loadingText = loadingIndicator.querySelector('p');
            if (loadingText) {
                loadingText.textContent = 'Analyzing your company profile...';
            }
            loadingIndicator.classList.remove('hidden');
        }

        // Start fade out of form
        wizardForm.classList.add('fade-out');

        setTimeout(() => {
            wizardForm.classList.add('no-display');
            wizardForm.classList.remove('fade-out');

            // Hide the main globe container
            const globeContainer = document.getElementById('globe-full');
            if (globeContainer) {
                globeContainer.style.display = 'none';
            }

            // Add full-width class and hide header
            countryDataContainer?.classList.add('full-width');
            wizardView?.classList.add('showing-results');

            // Run checks and prepare everything in background
            setTimeout(() => {
                runWizardCheck(formData);

                // Create mini globe in background
                createMiniGlobe();
                
                // Wait for mini globe to be ready, then highlight and show everything
                setTimeout(() => {
                    const hqId = currentAssessmentMode === 'quick-scan' ? formData.hqCountryId : formData.hqCountryFull;
                    const opIds = currentAssessmentMode === 'quick-scan' ? formData.operatingCountryIds : 
                        (formData.operatingCountriesFull ? formData.operatingCountriesFull.map(tag => tag.id).filter(Boolean) : []);
                    
                    highlightMiniGlobeCountries(hqId, opIds);
                    
                    // Hide loading and show results
                    if (loadingIndicator) {
                        loadingIndicator.classList.add('hidden');
                    }

                    // Show wizard top back button
                    wizardTopBackBtn?.classList.remove('hidden');

                    // Show mini globe and results together
                    const topRow = document.getElementById('top-row');
                    if (topRow) {
                        topRow.classList.remove('hidden');
                        topRow.style.display = 'flex'; // Explicitly show it
                    }

                    wizardResultsDiv.classList.remove('no-display');
                    wizardResultsDiv.classList.remove('hidden');
                    wizardResultsDiv.classList.add('fade-in');

                    setTimeout(() => {
                        wizardResultsDiv.classList.remove('fade-in');
                    }, 500);

                }, 800); // Wait for mini globe creation

            }, 200); // Small delay to ensure layout changes are applied

        }, 500); // Form fade out duration
    });

    viewCountryDetailsBtn?.addEventListener('click', () => {
        showLoading();
        setTimeout(() => {
             const hqIndex = carouselCountries.findIndex(c => c.isHQ);
             showCountryCarousel(hqIndex >= 0 ? hqIndex : 0);
        }, 150);
    });

    // --- Back to Form button (now handled by handleBackToMainView) ---

    // --- Smooth scroll ---
    const scrollLink = document.querySelector('.scroll-down');
    if (scrollLink) { scrollLink.addEventListener('click', function(e) { e.preventDefault(); const targetId = this.getAttribute('href'); const targetElement = document.querySelector(targetId); if (targetElement) { targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }); }

    // --- Cleanup ---
    window.addEventListener('beforeunload', () => {
        if (tagifyInstance) { try { tagifyInstance.destroy(); } catch(e){} }
        if (tagifyInstanceFull) { try { tagifyInstanceFull.destroy(); } catch(e){} }
        if (partialGlobe && !partialGlobe.isDisposed()) partialGlobe.dispose();
        if (fullGlobe && !fullGlobe.isDisposed()) fullGlobe.dispose();
        if (miniGlobe && !miniGlobe.isDisposed()) miniGlobe.dispose();
    });

    // --- Initial Setup ---
    populateGicsSectors();
    // populateCountriesDropdowns(); // Called after fetching JSON data successfully
    setPanelState('wizard'); // Start in Wizard View
    
    // Initialize tab switching
    initializeTabSwitching();
    
    // Initialize required fields for the default tab
    updateRequiredFields();
    
    // Initialize submit button visibility (should be visible for default quick scan)
    const submitBtn = document.querySelector('.wizard-submit');
    if (submitBtn) {
        submitBtn.classList.remove('hide-for-steps');
        submitBtn.style.display = ''; // Remove any inline styles to let CSS control
    }
    
    // Add event listeners for conditional fields in full assessment
    if (wizardCorporateRoleSelect) {
        wizardCorporateRoleSelect.addEventListener('change', updateConditionalFields);
    }
    
    // Initialize conditional fields
    updateConditionalFields();

    // EU IDs list
    const europeanUnionIds = [
        "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR",
        "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL",
        "PT", "RO", "SE", "SI", "SK"
    ];

}); // End DOMContentLoaded