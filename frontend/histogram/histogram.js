import pipeline from "../index.js";

// State management
const state = {
    selectedChannel: null
};

let svg, chartGroup, tooltip, xScale, yScale, width, height, margin;

/**
 * Calculate the engagement metric (total views / subscribers)
 */
function calculateMetric(channel) {
    const totalViews = +channel.view_count || 0;
    const subscribers = +channel.subscriber_count || 1;
    
    return totalViews / subscribers;
}

/**
 * Get the main category for a channel (first one if multiple)
 */
function getMainCategory(channel) {
    if (!channel.category) return 'Unknown';
    const categories = channel.category.split(',').map(c => c.trim());
    return categories[0];
}

/**
 * Calculate average metric for a country
 */
function calculateCountryAverage(data, country) {
    const countryChannels = data.filter(d => d.country === country);
    if (countryChannels.length === 0) return 0;
    
    const metrics = countryChannels.map(c => calculateMetric(c)).filter(m => m > 0);
    if (metrics.length === 0) return 0;
    
    return d3.mean(metrics);
}

/**
 * Calculate average metric for a category
 */
function calculateCategoryAverage(data, category) {
    const categoryChannels = data.filter(d => getMainCategory(d) === category);
    if (categoryChannels.length === 0) return 0;
    
    const metrics = categoryChannels.map(c => calculateMetric(c)).filter(m => m > 0);
    if (metrics.length === 0) return 0;
    
    return d3.mean(metrics);
}

/**
 * Format numbers for display
 */
function formatNumber(num) {
    if (num < 0.001) return num.toExponential(2);
    if (num < 1) return num.toFixed(3);
    return d3.format(".3f")(num);
}

/**
 * Initialize SVG and scales
 */
function initializeSVG() {
    const container = document.getElementById('svg');
    container.innerHTML = '';

    const rect = container.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    
    margin = { top: 80, right: 40, bottom: 100, left: 80 };

    svg = d3.select('#svg')
        .append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('width', '100%')
        .style('height', '100%')
        .style('font-family', 'Arial, sans-serif');

    // Back button
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

    // Title
    svg.append('text')
        .attr('class', 'chart-title')
        .attr('x', width / 2)
        .attr('y', 35)
        .attr('text-anchor', 'middle')
        .attr('font-size', '24px')
        .attr('font-weight', 'bold')
        .attr('fill', '#2d3748')
        .text('Engagement par Chaîne');

    // Subtitle
    svg.append('text')
        .attr('class', 'chart-subtitle')
        .attr('x', width / 2)
        .attr('y', 58)
        .attr('text-anchor', 'middle')
        .attr('font-size', '14px')
        .attr('fill', '#718096')
        .text('(Vues totales / Abonnés)');

    // Chart group
    chartGroup = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Tooltip
    if (!tooltip) {
        tooltip = d3.select('body').append('div')
            .attr('class', 'histogram-tooltip')
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

    // Initialize scales
    xScale = d3.scaleBand()
        .range([0, width - margin.left - margin.right])
        .padding(0.1);

    yScale = d3.scaleLinear()
        .range([height - margin.top - margin.bottom, 0]);
}

/**
 * Handle back button click
 */
function handleBackButtonClick() {
    state.selectedChannel = null;
    renderHistogram();
}

/**
 * Render the main histogram view
 */
function renderMainView() {
    const data = pipeline.run();
    
    // Calculate metrics for all channels
    const channelsWithMetrics = data
        .map(channel => ({
            ...channel,
            metric: calculateMetric(channel),
            mainCategory: getMainCategory(channel)
        }))
        .filter(d => d.metric > 0)
        .sort((a, b) => b.metric - a.metric)

    if (channelsWithMetrics.length === 0) {
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', height / 2)
            .attr('text-anchor', 'middle')
            .attr('font-size', '18px')
            .attr('fill', '#718096')
            .text('Aucune donnée disponible');
        return;
    }

    // Update scales
    xScale.domain(channelsWithMetrics.map((d, i) => i));
    yScale.domain([0, d3.max(channelsWithMetrics, d => d.metric) * 1.1]);

    // Hide back button
    svg.select('.back-button').style('display', 'none');

    // Update title
    svg.select('.chart-title').text('Engagement par Chaîne');
    svg.select('.chart-subtitle').style('opacity', 1);

    // X axis
    const xAxis = chartGroup.selectAll('.x-axis')
        .data([null]);

    xAxis.enter()
        .append('g')
        .attr('class', 'x-axis')
        .merge(xAxis)
        .attr('transform', `translate(0,${height - margin.top - margin.bottom})`)
        .call(d3.axisBottom(xScale).tickFormat(() => ''))
        .selectAll('text')
        .remove();

    // Y axis
    const yAxis = chartGroup.selectAll('.y-axis')
        .data([null]);

    yAxis.enter()
        .append('g')
        .attr('class', 'y-axis')
        .merge(yAxis)
        .transition()
        .duration(750)
        .call(d3.axisLeft(yScale).ticks(8).tickFormat(d => formatNumber(d)));

    // Y axis label
    const yLabel = chartGroup.selectAll('.y-label')
        .data([null]);

    yLabel.enter()
        .append('text')
        .attr('class', 'y-label')
        .attr('transform', 'rotate(-90)')
        .attr('y', -60)
        .attr('x', -(height - margin.top - margin.bottom) / 2)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('fill', '#4a5568')
        .text('Ratio d\'engagement');

    // Bars
    const bars = chartGroup.selectAll('.bar')
        .data(channelsWithMetrics, d => d.channel_id);

    // Exit
    bars.exit()
        .transition()
        .duration(500)
        .attr('y', height - margin.top - margin.bottom)
        .attr('height', 0)
        .style('opacity', 0)
        .remove();

    // Enter
    const barsEnter = bars.enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', (d, i) => xScale(i))
        .attr('width', xScale.bandwidth())
        .attr('y', height - margin.top - margin.bottom)
        .attr('height', 0)
        .attr('fill', '#4299e1')
        .style('cursor', 'pointer')
        .style('opacity', 0.8);

    // Update
    barsEnter.merge(bars)
        .on('mouseenter', function(event, d) {
            d3.select(this)
                .transition()
                .duration(200)
                .style('opacity', 1)
                .attr('fill', '#2b6cb0');

            tooltip
                .style('opacity', 1)
                .html(`
                    <strong>${d.channel_name}</strong><br/>
                    Pays: ${d.country}<br/>
                    Catégorie: ${d.mainCategory}<br/>
                    Abonnés: ${(+d.subscriber_count).toLocaleString('fr-FR')}<br/>
                    Vues totales: ${(+d.view_count).toLocaleString('fr-FR')}<br/>
                    Ratio: ${formatNumber(d.metric)}
                `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
        .on('mousemove', (event) => {
            tooltip
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseleave', function() {
            d3.select(this)
                .transition()
                .duration(200)
                .style('opacity', 0.8)
                .attr('fill', '#4299e1');

            tooltip.style('opacity', 0);
        })
        .on('click', (event, d) => {
            tooltip.style('opacity', 0);
            state.selectedChannel = d;
            renderZoomedView();
        })
        .transition()
        .duration(750)
        .attr('x', (d, i) => xScale(i))
        .attr('width', xScale.bandwidth())
        .attr('y', d => yScale(d.metric))
        .attr('height', d => height - margin.top - margin.bottom - yScale(d.metric))
        .style('opacity', 0.8);
}

/**
 * Render zoomed view with 3 bars comparison
 */
function renderZoomedView() {
    const channel = state.selectedChannel;
    const allData = pipeline.run();
    
    const channelMetric = channel.metric;
    const countryAvg = calculateCountryAverage(allData, channel.country);
    const categoryAvg = calculateCategoryAverage(allData, channel.mainCategory);

    const comparisonData = [
        {
            label: 'Chaîne',
            sublabel: channel.channel_name,
            value: channelMetric,
            color: '#4299e1',
            type: 'channel'
        },
        {
            label: 'Moyenne Pays',
            sublabel: channel.country,
            value: countryAvg,
            color: '#48bb78',
            type: 'country'
        },
        {
            label: 'Moyenne Catégorie',
            sublabel: channel.mainCategory,
            value: categoryAvg,
            color: '#ed8936',
            type: 'category'
        }
    ];

    // Show back button
    svg.select('.back-button').style('display', 'block');

    // Update title
    svg.select('.chart-title').text(`Comparaison: ${channel.channel_name}`);
    svg.select('.chart-subtitle').style('opacity', 0);

    // IMPORTANT: Remove all old bars first
    chartGroup.selectAll('.bar').remove();
    chartGroup.selectAll('.bar-label').remove();

    // Update scales
    xScale.domain(comparisonData.map(d => d.label));
    yScale.domain([0, d3.max(comparisonData, d => d.value) * 1.2]);

    // Update axes
    chartGroup.select('.x-axis')
        .transition()
        .duration(750)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .attr('font-size', '12px')
        .attr('font-weight', 'bold');

    chartGroup.select('.y-axis')
        .transition()
        .duration(750)
        .call(d3.axisLeft(yScale).ticks(8).tickFormat(d => formatNumber(d)));

    // Create new bars for comparison
    const bars = chartGroup.selectAll('.bar')
        .data(comparisonData, d => d.label)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => xScale(d.label))
        .attr('width', xScale.bandwidth())
        .attr('y', height - margin.top - margin.bottom)
        .attr('height', 0)
        .attr('fill', d => d.color)
        .style('cursor', 'default')
        .style('opacity', 0.8)
        .on('mouseenter', function(event, d) {
            d3.select(this)
                .transition()
                .duration(200)
                .style('opacity', 1);

            tooltip
                .style('opacity', 1)
                .html(`
                    <strong>${d.label}</strong><br/>
                    ${d.sublabel}<br/>
                    Ratio: ${formatNumber(d.value)}
                `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
        .on('mousemove', (event) => {
            tooltip
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseleave', function() {
            d3.select(this)
                .transition()
                .duration(200)
                .style('opacity', 0.8);

            tooltip.style('opacity', 0);
        });

    // Animate bars
    bars.transition()
        .duration(750)
        .attr('y', d => yScale(d.value))
        .attr('height', d => height - margin.top - margin.bottom - yScale(d.value));

    // Add value labels on top of bars
    const labels = chartGroup.selectAll('.bar-label')
        .data(comparisonData, d => d.label)
        .enter()
        .append('text')
        .attr('class', 'bar-label')
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('font-weight', 'bold')
        .attr('fill', '#2d3748')
        .attr('x', d => xScale(d.label) + xScale.bandwidth() / 2)
        .attr('y', d => yScale(d.value) - 8)
        .style('opacity', 0)
        .text(d => formatNumber(d.value));

    labels.transition()
        .duration(750)
        .style('opacity', 1);
}

/**
 * Main render function
 */
function renderHistogram() {
    initializeSVG();
    
    if (state.selectedChannel) {
        renderZoomedView();
    } else {
        renderMainView();
    }
}

/**
 * Reset zoom state (called when filters are applied)
 */
function resetZoom() {
    state.selectedChannel = null;
}

export { renderHistogram, resetZoom };
