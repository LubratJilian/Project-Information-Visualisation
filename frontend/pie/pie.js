import pipeline from "../index.js";


const state = {
    currentCategory: null,
    countriesSelected: [],
    isInitialized: false
};


let svg;
let bubblesGroup;
let tooltip;
let width;
let height;
let radius;

function handleBackButtonClick() {
    if (state.currentCategory) {
        state.currentCategory = null;
        renderPieChart();
    }
}


function initializeSVG() {
    const container = document.getElementById('svg');
    container.innerHTML = '';

    const rect = container.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    radius = Math.min(width, height) / 2 - 60;

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


    bubblesGroup = svg.append('g')
        .attr('class', 'pie-group')
        .attr('transform', `translate(${width / 2}, ${height / 2})`);


    if (!tooltip) {
        tooltip = d3.select('body').append('div')
            .attr('class', 'pie-tooltip')
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
}


function prepareData() {
    const data = pipeline.run();

    if (!state.currentCategory) {
        // Vue par catégories
        const expandedData = [];
        for (const item of data) {
            const categories = item.category ?
                item.category.split(',').map(c => c.trim()) :
                ['Non défini'];
            for (const cat of categories) {
                expandedData.push({
                    category: cat,
                    views: +item.view_count || 0
                });
            }
        }

        const categoryData = d3.rollup(
            expandedData,
            v => d3.sum(v, d => d.views),
            d => d.category
        );

        const result = Array.from(categoryData, ([category, views]) => ({
            name: category,
            value: views,
            isCategory: true
        })).sort((a, b) => b.value - a.value);

        if (result.length > 10) {
            const top9 = result.slice(0, 9);
            const others = result.slice(9);
            const othersSum = d3.sum(others, d => d.value);
            top9.push({
                name: 'Autres',
                value: othersSum,
                isCategory: true,
                isOthers: true
            });
            return top9;
        }

        return result;

    } else {
        const categoryData = data.filter(d => {
            const categories = d.category ?
                d.category.split(',').map(c => c.trim()) :
                [];
            return categories.includes(state.currentCategory);
        });

        const channelData = d3.rollup(
            categoryData,
            v => d3.sum(v, d => +d.view_count || 0),
            d => d.channel_name || 'Unknown'
        );

        const result = Array.from(channelData, ([channel, views]) => ({
            name: channel,
            value: views,
            isChannel: true
        })).sort((a, b) => b.value - a.value);

        if (result.length > 10) {
            const top9 = result.slice(0, 9);
            const others = result.slice(9);
            const othersSum = d3.sum(others, d => d.value);
            top9.push({
                name: 'Autres',
                value: othersSum,
                isChannel: true,
                isOthers: true
            });
            return top9;
        }

        return result;
    }
}


function updateTitle() {
    let title = 'Vues par Catégorie';

    if (state.currentCategory) {
        title = `Chaînes - ${state.currentCategory}`;
    }

    svg.select('.chart-title').text(title);
}


function updateBackButton() {
    const shouldShow = state.currentCategory !== null;
    svg.select('.back-button').style('display', shouldShow ? 'block' : 'none');
}

function createColorScale(data) {
    const colors = d3.quantize(d3.interpolateTurbo, data.length);
    return d3.scaleOrdinal()
        .domain(data.map(d => d.name))
        .range(colors);
}

function renderPieChart() {
    initializeSVG();
    updateTitle();
    updateBackButton();

    const data = prepareData();

    if (data.length === 0) {
        bubblesGroup.append('text')
            .attr('text-anchor', 'middle')
            .attr('fill', '#b00')
            .attr('font-size', '18px')
            .text('Aucune donnée disponible');
        return;
    }

    const colorScale = createColorScale(data);

    const pie = d3.pie()
        .value(d => d.value)
        .sort(null);

    const arc = d3.arc()
        .innerRadius(0)
        .outerRadius(radius);

    const pieData = pie(data);

    const transitionDuration = state.isInitialized ? 600 : 0;
    state.isInitialized = true;

    const t = svg.transition()
        .duration(transitionDuration)
        .ease(d3.easeCubicInOut);

    const arcs = bubblesGroup.selectAll('g.arc')
        .data(pieData, d => d.data.name);

    arcs.exit()
        .transition(t)
        .style('opacity', 0)
        .remove();

    const arcsEnter = arcs.enter()
        .append('g')
        .attr('class', 'arc')
        .style('cursor', 'pointer')
        .style('opacity', 0);

    arcsEnter.append('path')
        .attr('fill', d => colorScale(d.data.name))
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .each(function (d) {
            this._current = d;
        });

    arcsEnter.append('text')
        .attr('transform', d => `translate(${arc.centroid(d)})`)
        .attr('text-anchor', 'middle')
        .attr('fill', '#fff')
        .attr('font-size', '12px')
        .attr('font-weight', 'bold')
        .style('text-shadow', '2px 2px 4px rgba(0,0,0,0.8)')
        .style('pointer-events', 'none');

    const arcsUpdate = arcsEnter.merge(arcs);

    arcsUpdate
        .transition(t)
        .style('opacity', 1);

    arcsUpdate.select('path')
        .transition(t)
        .attrTween('d', function (d) {
            const interpolate = d3.interpolate(this._current || d, d);
            this._current = interpolate(1);
            return t => arc(interpolate(t));
        });

    arcsUpdate.select('text')
        .transition(t)
        .attr('transform', d => `translate(${arc.centroid(d)})`)
        .tween('text', function (d) {
            const that = d3.select(this);
            const total = d3.sum(data, item => item.value);
            const percent = ((d.data.value / total) * 100).toFixed(1);
            return function (t) {
                if (t > 0.5) {
                    const angle = d.endAngle - d.startAngle;
                    if (angle > 0.2) {
                        that.text(`${percent}%`);
                    } else {
                        that.text('');
                    }
                }
            };
        });

    arcsUpdate
        .on('mouseenter', function (event, d) {
            d3.select(this).select('path')
                .transition()
                .duration(200)
                .attr('stroke-width', 3);

            const total = d3.sum(data, item => item.value);
            const percent = ((d.data.value / total) * 100).toFixed(1);

            tooltip
                .style('opacity', 1)
                .html(`<strong>${d.data.name}</strong><br/>${percent}%<br/>${d.data.value.toLocaleString('fr-FR')} vues`)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
        .on('mousemove', (event) => {
            tooltip
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseleave', function () {
            d3.select(this).select('path')
                .transition()
                .duration(200)
                .attr('stroke-width', 2);

            tooltip.style('opacity', 0);
        })
        .on('click', function (event, d) {
            tooltip.style('opacity', 0);

            if (d.data.isCategory && !d.data.isOthers) {
                state.currentCategory = d.data.name;
                renderPieChart();
            }
        });
}

export {renderPieChart};
