import pipeline from "../index.js";
import {baseCountryCodeToFullName, formatNumber, truncateText, updateMultiSelectDisplay} from "../utils/utils.js";

const state = {
    selectedCountry: null, selectedCategory: null, countriesSelected: [], categoriesSelected: [], isInitialized: false
};
let svg;
let tooltip;
let width;
let height;


function handleBackButtonClick() {
    if (state.selectedCategory) {
        state.selectedCategory = null;

        if (state.categoriesSelected.length > 0) {
            pipeline.addOperation('categoryFilter', data => {
                return data.filter(d => {
                    if (!d.category) return false;
                    const channelCategories = new Set(d.category.split(',').map(cat => cat.trim()));
                    return state.categoriesSelected.some(selected => channelCategories.has(selected));
                });
            });

            for (const item of document.querySelectorAll("#categoryDropdown .multi-select-item")) {
                const checkbox = item.querySelector("input");
                checkbox.checked = state.categoriesSelected.includes(checkbox.value);
            }
            updateMultiSelectDisplay(state.categoriesSelected, 'category');
        } else {
            pipeline.removeOperation("categoryFilter");
            for (const cb of document.querySelectorAll("#categoryDropdown .multi-select-items input[type='checkbox']")) cb.checked = false;
            updateMultiSelectDisplay([], 'category');
        }

        renderTreemap();
    } else if (state.selectedCountry) {
        state.selectedCountry = null;

        if (state.countriesSelected.length > 0) {
            pipeline.addOperation('countryFilter', data => data.filter(d => state.countriesSelected.includes(d.country)));
            for (const item of document.querySelectorAll("#countryDropdown .multi-select-item")) if (state.countriesSelected.includes(item.textContent)) item.querySelector("input").checked = true;
            updateMultiSelectDisplay(state.countriesSelected);
        } else {
            pipeline.removeOperation("countryFilter");
            for (const cb of document.querySelectorAll("#countryDropdown .multi-select-items input[type='checkbox']")) cb.checked = false;
            updateMultiSelectDisplay([]);
        }
        renderTreemap();
    }
}

function initializeSVG() {
    const container = document.getElementById('svg');
    container.innerHTML = '';

    const rect = container.getBoundingClientRect();
    width = rect.width;
    height = rect.height;

    svg = d3.select('#svg')
        .append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .style('width', '100%')
        .style('height', '100%')
        .style('font-family', 'Arial, sans-serif');

    const backButtonGroup = svg.append('g')
        .attr('class', 'back-button')
        .style('cursor', 'pointer')
        .style('display', 'none')
        .on('click', handleBackButtonClick);

    backButtonGroup.append('rect')
        .attr('x', 10)
        .attr('y', 10)
        .attr('width', 100)
        .attr('height', 35)
        .attr('rx', 5)
        .attr('fill', '#4a5568')
        .attr('opacity', 0.9);

    backButtonGroup.append('text')
        .attr('x', 60)
        .attr('y', 32)
        .attr('text-anchor', 'middle')
        .attr('fill', 'white')
        .attr('font-size', '14px')
        .attr('font-weight', 'bold')
        .text('← Retour');

    svg.append('text')
        .attr('class', 'chart-title')
        .attr('x', width / 2)
        .attr('y', 30)
        .attr('text-anchor', 'middle')
        .attr('font-size', '24px')
        .attr('font-weight', 'bold')
        .attr('fill', '#2d3748');

    svg.append('g')
        .attr('class', 'treemap-group')
        .attr('transform', 'translate(0, 50)');

    if (!tooltip) tooltip = d3.select('body').append('div')
        .attr('class', 'treemap-tooltip')
        .style('position', 'absolute')
        .style('padding', '10px')
        .style('background', 'rgba(0, 0, 0, 0.8)')
        .style('color', 'white')
        .style('border-radius', '5px')
        .style('pointer-events', 'none')
        .style('opacity', 0)
        .style('font-size', '12px')
        .style('z-index', '1000');
}

function prepareHierarchy() {
    let data = pipeline.run();
    let hierarchy;

    const id = state.selectedCountry === "Non défini" ? "" : state.selectedCountry;

    if (state.selectedCountry && document.getElementById(`countryDropdown-${id}`).checked === false) {
        state.selectedCountry = document.querySelectorAll("#countryDropdown .multi-select-item input[type='checkbox']:checked")[0]?.value || null;
        updateTitle();
    }

    if (!state.selectedCountry) {
        const countryGroups = Array.from(d3.group(data, d => d.country || 'Non défini'), ([country, channels]) => ({
            name: country,
            value: d3.sum(channels, c => +c.subscriber_count || 0),
            count: channels.length,
            isCountry: true
        }));

        const allCountries = countryGroups.sort((a, b) => b.value - a.value);

        hierarchy = {
            name: "root", children: allCountries
        };
    } else if (state.selectedCountry && !state.selectedCategory) {
        const countryData = data.filter(d => (d.country || 'Non défini') === state.selectedCountry);

        const expandedData = [];
        for (const channel of countryData) {
            const categories = channel.category ? channel.category.split(',').map(c => c.trim()) : ['Non défini'];
            for (const cat of categories) expandedData.push({
                ...channel, category: cat
            });
        }

        const categoryGroups = Array.from(d3.group(expandedData, d => d.category), ([category, channels]) => ({
            name: category,
            value: d3.sum(channels, c => +c.subscriber_count || 0),
            count: channels.length,
            isCategory: true
        }));

        const allCategories = categoryGroups.sort((a, b) => b.value - a.value);

        hierarchy = {
            name: "root", children: allCategories
        };
    } else {
        const categoryData = data
            .filter(d => {
                if ((d.country || 'Non défini') !== state.selectedCountry) return false;
                const categories = d.category ? d.category.split(',').map(c => c.trim()) : [];
                return categories.includes(state.selectedCategory);
            })
            .sort((a, b) => (+b.subscriber_count || 0) - (+a.subscriber_count || 0));

        hierarchy = {
            name: "root", children: categoryData.map(c => ({
                name: c.channel_name, value: +c.subscriber_count || 1, data: c, isChannel: true
            }))
        };
    }

    return d3.hierarchy(hierarchy)
        .sum(d => d.value)
        .sort((a, b) => b.value - a.value);
}

function updateTitle() {
    let title = 'YouTubeurs par Pays';

    if (state.selectedCountry && !state.selectedCategory) title = `Catégories - ${state.selectedCountry}`; else if (state.selectedCountry && state.selectedCategory) title = `Chaînes - ${state.selectedCategory}`;

    svg.select('.chart-title').text(title);
}

function updateBackButton() {
    const shouldShow = state.selectedCountry !== null;
    svg.select('.back-button').style('display', shouldShow ? 'block' : 'none');
}

function renderTreemap() {
    initializeSVG();

    updateTitle();
    updateBackButton();

    const root = prepareHierarchy();

    const treemap = d3.treemap()
        .size([width, height - 60])
        .paddingOuter(3)
        .paddingInner(2)
        .round(true);

    treemap(root);

    const colorScale = d3.scaleOrdinal(d3.schemeTableau10);
    const treemapGroup = svg.select('.treemap-group');

    const transitionDuration = state.isInitialized ? 600 : 0;
    state.isInitialized = true;

    const transitionName = 'treemap-morph';
    const t = svg.transition(transitionName)
        .duration(transitionDuration)
        .ease(d3.easeCubicInOut);

    const nodes = treemapGroup.selectAll('g.node')
        .data(root.descendants().filter(d => d.depth > 0), d => {
            if (d.data.isCountry) return `country-${d.data.name}`;
            if (d.data.isCategory) return `category-${d.data.name}`;
            if (d.data.isChannel) return `channel-${d.data.data?.channel_id || d.data.name}`;
            return d.data.name;
        });

    const exitNodes = nodes.exit();

    exitNodes
        .transition(transitionName)
        .duration(transitionDuration)
        .style('opacity', 0)
        .remove();

    const nodesEnter = nodes.enter()
        .append('g')
        .attr('class', 'node')
        .attr('transform', `translate(${width / 2},${(height - 60) / 2})`);

    nodesEnter.append('rect')
        .attr('class', 'node-rect')
        .attr('width', 0)
        .attr('height', 0)
        .attr('fill', d => colorScale(d.data.name))
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .attr('opacity', 0.8)
        .style('cursor', d => (d.data.isCountry || d.data.isCategory || d.data.isChannel) ? 'pointer' : 'default');

    nodesEnter.filter(d => d.data.isChannel)
        .append('image')
        .attr('class', 'node-image')
        .attr("xlink:href", d => `/proxy?url=${encodeURIComponent(d.data.data?.thumbnail || '')}`)
        .attr('width', 0)
        .attr('height', 0)
        .style('opacity', 0.7)
        .on('error', () => d3.select(this).remove());

    nodesEnter.filter(d => d.data.isChannel)
        .append('rect')
        .attr('class', 'node-overlay')
        .attr('width', 0)
        .attr('height', 0)
        .attr('fill', 'rgba(0,0,0,0.3)')
        .style('cursor', 'pointer');

    nodesEnter.filter(d => d.data.isCountry || d.data.isCategory)
        .append('text')
        .attr('class', 'node-label')
        .attr('x', d => (d.x1 - d.x0) / 2)
        .attr('y', d => Math.max((d.y1 - d.y0) / 2, 18))
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .text(d => d.x1 - d.x0 >= 30 ? d.data.name : '')
        .attr('font-size', d => Math.max(12, Math.min(24, Math.min(d.x1 - d.x0, d.y1 - d.y0) / 8)) + 'px')
        .attr('font-weight', 'bold')
        .attr('fill', '#fff')
        .style('pointer-events', 'none')
        .style('text-shadow', '2px 2px 4px rgba(0,0,0,0.8)')
        .each(d => {
            if (d.x1 - d.x0 >= 30 && d3.select(this).node()) truncateText(d3.select(this), d.x1 - d.x0 - 10);
        });

    nodesEnter.filter(d => d.data.isCountry || d.data.isCategory)
        .append('text')
        .attr('class', 'node-count')
        .attr('x', d => (d.x1 - d.x0) / 2)
        .attr('y', d => Math.min((d.y1 - d.y0 / 2) + 20, d.y1 - d.y0 - 8))
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .text(d => d.y1 - d.y0 >= 40 ? formatNumber(d.value) + ' abonnés' : '')
        .attr('font-size', '12px')
        .attr('fill', '#fff')
        .style('pointer-events', 'none')
        .style('text-shadow', '1px 1px 3px rgba(0,0,0,0.8)')
        .each(d => {
            if (d.x1 - d.x0 > 0 && d3.select(this).node()) truncateText(d3.select(this), d.x1 - d.x0 - 10);
        });

    const nodesUpdate = nodesEnter.merge(nodes);

    nodesUpdate
        .transition(t)
        .style('opacity', 1)
        .attr('transform', d => `translate(${d.x0},${d.y0})`);

    nodesUpdate.select('.node-rect')
        .transition(t)
        .attr('width', d => d.x1 - d.x0)
        .attr('height', d => d.y1 - d.y0);

    nodesUpdate.select('.node-image')
        .transition(t)
        .attr('width', d => d.x1 - d.x0)
        .attr('height', d => d.y1 - d.y0);

    nodesUpdate.select('.node-overlay')
        .transition(t)
        .attr('width', d => d.x1 - d.x0)
        .attr('height', d => d.y1 - d.y0);

    nodesUpdate.select('.node-label')
        .transition(t)
        .attr('x', d => (d.x1 - d.x0) / 2)
        .attr('y', d => (d.y1 - d.y0) / 2)
        .attr('font-size', d => Math.max(12, Math.min(24, Math.min(d.x1 - d.x0, d.y1 - d.y0) / 8)) + 'px')
        .tween('text', function (d) {
            const that = d3.select(this);
            return function (t) {
                if (t > 0.5) {
                    const width = d.x1 - d.x0;
                    that.text(d.data.name);
                    truncateText(that, width);
                }
            };
        });

    nodesUpdate.select('.node-count')
        .transition(t)
        .attr('x', d => (d.x1 - d.x0) / 2)
        .attr('y', d => {
            const boxHeight = d.y1 - d.y0;
            const labelOffset = 20;
            const padding = 8;
            return Math.min((boxHeight / 2) + labelOffset, boxHeight - padding);
        })
        .tween('text', function (d) {
            const that = d3.select(this);
            return function (t) {
                if (t > 0.5) {
                    const boxHeight = d.y1 - d.y0;
                    const boxWidth = d.x1 - d.x0;
                    if (boxHeight >= 40) {
                        that.text(formatNumber(d.value) + ' abonnés');
                        if (boxWidth > 0) truncateText(that, boxWidth - 10);
                    } else that.text('');
                }
            };
        });

    nodesUpdate
        .on('mouseenter', function (event, d) {
            if (d.data.isCountry || d.data.isCategory) d3.select(this).select('.node-rect')
                .transition()
                .duration(200)
                .attr('opacity', 1); else d3.select(this).select('.node-overlay')
                .transition()
                .duration(200)
                .attr('fill', 'rgba(0,0,0,0.1)');

            let tooltipContent = '';
            if (d.data.isCountry) tooltipContent = `<strong>${baseCountryCodeToFullName(d.data.name)}</strong><br/>` + `${d.data.count} YouTubeurs<br/>` + `${formatNumber(d.value)} abonnés`; else if (d.data.isCategory) tooltipContent = `<strong>${d.data.name}</strong><br/>` + `${d.data.count} chaînes<br/>` + `${formatNumber(d.value)} abonnés`; else if (d.data.isChannel) {
                const subs = (+d.data.value).toLocaleString('fr-FR');
                const category = d.data.data?.category || 'Non catégorisé';
                tooltipContent = `<strong>${d.data.name}</strong><br/>` + `Catégorie: ${category}<br/>` + `Abonnés: ${subs}`;
            }

            tooltip
                .style('opacity', 1)
                .html(tooltipContent)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
        .on('mousemove', (event) => tooltip
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px'))
        .on('mouseleave', function (event, d) {
            if (d.data.isCountry || d.data.isCategory) d3.select(this).select('.node-rect')
                .transition()
                .duration(200)
                .attr('opacity', 0.8); else d3.select(this).select('.node-overlay')
                .transition()
                .duration(200)
                .attr('fill', 'rgba(0,0,0,0.3)');

            tooltip.style('opacity', 0);
        })
        .on('click', function (event, d) {
            tooltip.style('opacity', 0);

            if (d.data.isCountry) {
                state.countriesSelected = [];
                const checkboxes = document.querySelectorAll('#countryDropdown .multi-select-items input[type="checkbox"]');
                for (const cb of checkboxes) if (cb.checked) state.countriesSelected.push(cb.parentElement.textContent);

                state.selectedCountry = d.data.name;
                pipeline.addOperation('countryFilter', data => data.filter(item => (item.country || 'Non défini') === state.selectedCountry));

                for (const item of document.querySelectorAll("#countryDropdown .multi-select-item"))
                    item.querySelector("input").checked = (item.dataset.value.toUpperCase() || "Non défini") === state.selectedCountry;
                updateMultiSelectDisplay([state.selectedCountry]);

                renderTreemap();
            } else if (d.data.isCategory) {
                state.categoriesSelected = [];
                for (const cb of document.querySelectorAll('#categoryDropdown .multi-select-items input[type="checkbox"]')) if (cb.checked) state.categoriesSelected.push(cb.value);

                state.selectedCategory = d.data.name;

                pipeline.addOperation('categoryFilter', data => {
                    return data.filter(item => {
                        const channelCategories = new Set(item.category.split(',').map(c => c.trim()));
                        return item.category ? channelCategories.has(state.selectedCategory) : false;
                    });
                });

                for (const item of document.querySelectorAll("#categoryDropdown .multi-select-item")) {
                    const checkbox = item.querySelector("input");
                    checkbox.checked = checkbox.value === state.selectedCategory;
                }
                updateMultiSelectDisplay([state.selectedCategory], 'category');

                renderTreemap();
            } else if (d.data.isChannel && d.data.data?.channel_id) window.open(`https://www.youtube.com/channel/${d.data.data.channel_id}`, '_blank');
        });
}

export {renderTreemap};
