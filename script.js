document.addEventListener('DOMContentLoaded', async function() {

    am4core.useTheme(am4themes_animated);

    let esgData = {};
    let partialGlobe, fullGlobe;
    let fullPolygonSeries;
    // Initialize as empty, will be populated from data.json
    let countryListForDropdown = [];
    let tagifyInstance = null;
    let wizardHqCountryId = null;
    let wizardOperatingCountryIds = [];
    let carouselCountries = [];
    let currentCarouselIndex = -1;
    let activePolygon = null;
    let hqState;

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
    const wizardResultsDiv = document.getElementById('wizard-results');
    const wizardResultsList = document.getElementById('wizard-results-list');
    const backToFormBtn = document.getElementById('back-to-form-btn'); // Added back button element
    const viewCountryDetailsBtn = document.getElementById('view-country-details-btn');
    const loadingIndicator = document.getElementById('loading-indicator');
    const backToWizardBtn = document.getElementById('back-to-wizard-btn');
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

        if (state === 'country') {
            countryDataContainer.classList.add('view-country-data');
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
    function showLoading() { setPanelState('loading'); }
    function hideLoading() { /* setPanelState handles hiding */ }

    // --- Populate Dropdowns & Tagify ---
    function populateGicsSectors() {
        if (!wizardSectorSelect) return;
        wizardSectorSelect.innerHTML = '<option value="">-- Select Sector --</option>';
        gicsSectors.forEach(sector => {
            const option = document.createElement('option');
            option.value = sector.toLowerCase().replace(/ /g, '-');
            option.textContent = sector;
            wizardSectorSelect.appendChild(option);
        });
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

        // Populate HQ Select
        if (wizardHqCountrySelect) {
            wizardHqCountrySelect.innerHTML = '<option value="">-- Select HQ Country --</option>';
            sortedCountries.forEach(country => {
                const option = document.createElement('option');
                option.value = country.id; // ID (e.g., "DE")
                option.textContent = country.name; // Name (e.g., "Germany")
                wizardHqCountrySelect.appendChild(option);
            });
            console.log("HQ Select populated.");
        } else { console.error("HQ Select element not found!"); }

        // Initialize Tagify
        if (wizardOperatingCountriesInput && Tagify) {
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
        } else {
             if (!wizardOperatingCountriesInput) console.error("Tagify input element not found!");
             if (!Tagify) console.error("Tagify library not loaded!");
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

                 // Regulations list
                 regulationsList.innerHTML = '';
                 if (countryData.regulations && countryData.regulations.length > 0) {
                     countryData.regulations.forEach(reg => {
                         const item = document.createElement('div'); item.className = `regulation-item ${reg.status || 'pending'}`;
                         const icon = document.createElement('span'); icon.className = 'icon'; icon.textContent = reg.status === 'success' ? '✓' : (reg.status === 'pending' ? '○' : '?');
                         const textDiv = document.createElement('div'); const strong = document.createElement('strong'); strong.textContent = reg.name || 'N/A';
                         if (reg.year) { const yearSpan = document.createElement('span'); yearSpan.className = 'year'; yearSpan.textContent = `(${reg.year})`; strong.appendChild(yearSpan); }
                         const p = document.createElement('p'); p.textContent = reg.description || 'No description.';
                         textDiv.appendChild(strong); textDiv.appendChild(p); item.appendChild(icon); item.appendChild(textDiv); regulationsList.appendChild(item);
                     });
                 } else { regulationsList.innerHTML = '<p>No specific regulations listed in our dataset.</p>'; }

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

    // --- Wizard Logic ---
    // runWizardCheck() remains the same
    function runWizardCheck(employeeCount, sector, hqCountryId, operatingCountryIds) {
        console.log("Running wizard check:", { employeeCount, sector, hqCountryId, operatingCountryIds });
        wizardResultsDiv?.classList.add('hidden');
        viewCountryDetailsBtn?.classList.add('hidden');

        const applicableRegulations = [];
        const allSelectedIds = [hqCountryId, ...operatingCountryIds].filter(Boolean);
        const isEUCompany = allSelectedIds.some(id => europeanUnionIds.includes(id));
        const largeCompanyThreshold = 250; const veryLargeCompanyThreshold = 500;

        // Simplified Regulation Logic (Placeholder)
        let csrdApplies = false;
        if (employeeCount >= largeCompanyThreshold && isEUCompany) { csrdApplies = true; applicableRegulations.push({ name: 'CSRD / ESRS Reporting', reason: `Likely applies due to size (>=${largeCompanyThreshold} employees) and EU presence.` }); }
        if (csrdApplies) { applicableRegulations.push({ name: 'EU Taxonomy Reporting', reason: 'Likely required as company falls under CSRD scope.' }); }
        const highImpactSectors = ['materials', 'industrials', 'consumer-discretionary'];
        if (isEUCompany && employeeCount >= veryLargeCompanyThreshold) { applicableRegulations.push({ name: 'CSDDD (Due Diligence)', reason: `Likely applies due to size (>=${veryLargeCompanyThreshold} employees) and EU presence.` }); }
        else if (isEUCompany && employeeCount >= largeCompanyThreshold && highImpactSectors.includes(sector)) { applicableRegulations.push({ name: 'CSDDD (Due Diligence)', reason: `May apply due to size (>=${largeCompanyThreshold}) in a high-impact sector within the EU.` }); }
        if (sector === 'financials') { applicableRegulations.push({ name: 'SFDR (Disclosure Regulation)', reason: 'Applies to financial market participants.' }); }

        // Display results
        wizardResultsList.innerHTML = '';
        if (applicableRegulations.length > 0) { applicableRegulations.forEach(reg => { const li = document.createElement('li'); li.innerHTML = `<strong>${reg.name}:</strong> ${reg.reason}`; wizardResultsList.appendChild(li); }); }
        else { wizardResultsList.innerHTML = '<li>Based on the criteria, major EU-wide ESG regulations might not directly apply thresholds, but national rules or voluntary standards could be relevant.</li>'; }
        // wizardResultsDiv.classList.remove('hidden'); // Let the caller handle showing/hiding

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


    // --- Event Listeners ---
    backToWizardBtn?.addEventListener('click', () => {
        carouselCountries = []; currentCarouselIndex = -1; // Reset carousel state

        // Reset view: Show form, hide results, hide carousel controls
        wizardForm?.classList.remove('no-display', 'fade-out', 'fade-in');
        wizardResultsDiv?.classList.add('no-display', 'hidden'); // Ensure results are hidden
        wizardResultsDiv?.classList.remove('fade-out', 'fade-in');
        carouselControls?.classList.add('hidden');

        setPanelState('wizard'); // Set the main container state
    });

    wizardForm?.addEventListener('submit', function(event) {
        event.preventDefault();

        // --- Get form data --- (Keep this part)
        const employees = parseInt(wizardEmployeesInput.value, 10) || 0;
        const sector = wizardSectorSelect.value;
        const hqId = wizardHqCountrySelect.value;
        const operatingTags = tagifyInstance ? tagifyInstance.value : [];
        // IMPORTANT: tagifyInstance.value gives [{value: "Name", id: "CODE"}, ...]
        // We need just the IDs
        const opIds = operatingTags.map(tag => tag.id).filter(Boolean);

        if (!hqId) { alert("Please select an HQ country."); return; }
        // if (!sector) { alert("Please select a primary GICS sector."); return; }

        // --- Run checks (populates results list internally) ---
        runWizardCheck(employees, sector, hqId, opIds);

        // --- Animation Logic ---
        wizardForm.classList.add('fade-out');

        setTimeout(() => {
            wizardForm.classList.add('no-display'); // Hide form after fade out
            wizardForm.classList.remove('fade-out');

            wizardResultsDiv.classList.remove('no-display'); // Make sure results container is displayable
            wizardResultsDiv.classList.remove('hidden'); // Remove initial hidden if present
            wizardResultsDiv.classList.add('fade-in'); // Start fade-in

            // Remove fade-in class after animation completes
            setTimeout(() => {
                wizardResultsDiv.classList.remove('fade-in');
            }, 500); // Match CSS animation duration

        }, 500); // Match CSS animation duration
    });

    viewCountryDetailsBtn?.addEventListener('click', () => {
        showLoading();
        setTimeout(() => {
             const hqIndex = carouselCountries.findIndex(c => c.isHQ);
             showCountryCarousel(hqIndex >= 0 ? hqIndex : 0);
        }, 150);
    });

    // --- NEW: Add listener for the 'Back to Form' button ---
    backToFormBtn?.addEventListener('click', () => {
        wizardResultsDiv.classList.add('fade-out');

        setTimeout(() => {
            wizardResultsDiv.classList.add('no-display'); // Hide results
            wizardResultsDiv.classList.add('hidden'); // Also add hidden just in case
            wizardResultsDiv.classList.remove('fade-out');

            wizardForm.classList.remove('no-display'); // Show form
            wizardForm.classList.add('fade-in');

             // Clear highlights when going back to form
             clearMultiCountryHighlights();

            setTimeout(() => {
                wizardForm.classList.remove('fade-in');
            }, 500); // Match CSS duration

        }, 500); // Match CSS duration
    });

    // --- Smooth scroll ---
    const scrollLink = document.querySelector('.scroll-down');
    if (scrollLink) { scrollLink.addEventListener('click', function(e) { e.preventDefault(); const targetId = this.getAttribute('href'); const targetElement = document.querySelector(targetId); if (targetElement) { targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }); }

    // --- Cleanup ---
    window.addEventListener('beforeunload', () => {
        if (tagifyInstance) { try { tagifyInstance.destroy(); } catch(e){} }
        if (partialGlobe && !partialGlobe.isDisposed()) partialGlobe.dispose();
        if (fullGlobe && !fullGlobe.isDisposed()) fullGlobe.dispose();
    });

    // --- Initial Setup ---
    populateGicsSectors();
    // populateCountriesDropdowns(); // Called after fetching JSON data successfully
    setPanelState('wizard'); // Start in Wizard View

    // EU IDs list
    const europeanUnionIds = [
        "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR",
        "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL",
        "PT", "RO", "SE", "SI", "SK"
    ];

}); // End DOMContentLoaded