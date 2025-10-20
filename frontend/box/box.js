import pipeline from "../index.js";

const state = {
    selectedCountry: null,
    selectedCategory: null
};

function formatNumber(num) {
    return d3.format(".2s")(num);
}

function prepareHierarchy() {
    let data = pipeline.data;
    let hierarchy;

    if (!state.selectedCountry) {
        const countryGroups = Array.from(
            d3.group(data, d => d.country || 'Unknown'),
            ([country, channels]) => ({
                name: country,
                value: d3.sum(channels, c => +c.subscriber_count || 0),
                isCountry: true
            })
        );

        const top15Countries = countryGroups
            .sort((a, b) => b.value - a.value)
            .slice(0, 15);

        hierarchy = {
            name: "root",
            children: top15Countries
        };
    } else if (state.selectedCountry && !state.selectedCategory) {
        const countryData = data.filter(d => d.country === state.selectedCountry);

        const expandedData = [];
        for (const channel of countryData) {
            const categories = channel.category ? channel.category.split(',').map(c => c.trim()) : ['Unknown'];
            for (const cat of categories) {
                expandedData.push({
                    ...channel,
                    category: cat
                });
            }
        }

        const categoryGroups = Array.from(
            d3.group(expandedData, d => d.category),
            ([category, channels]) => ({
                name: category,
                value: d3.sum(channels, c => +c.subscriber_count || 0),
                isCategory: true
            })
        );

        const top15Categories = categoryGroups
            .sort((a, b) => b.value - a.value)
            .slice(0, 15);

        hierarchy = {
            name: "root",
            children: top15Categories
        };
    } else {
        const categoryData = data
            .filter(d => {
                if (d.country !== state.selectedCountry) return false;
                const categories = d.category ? d.category.split(',').map(c => c.trim()) : [];
                return categories.includes(state.selectedCategory);
            })
            .sort((a, b) => (+b.subscriber_count || 0) - (+a.subscriber_count || 0))
            .slice(0, 100);

        hierarchy = {
            name: "root",
            children: categoryData.map(c => ({
                name: c.channel_name,
                value: +c.subscriber_count || 1,
                data: c,
                isChannel: true
            }))
        };
    }

    return d3.hierarchy(hierarchy)
        .sum(d => d.value)
        .sort((a, b) => b.value - a.value);
}

function renderTreemap() {
    const container = document.getElementById('svg');
    container.innerHTML = '';

    const rect = container.getBoundingClientRect();
    const width = rect.width || 1400;
    const height = rect.height || 600;

    const svg = d3.select('#svg')
        .append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .style('width', '100%')
        .style('height', '100%')
        .style('font-family', 'Arial, sans-serif');

    const root = prepareHierarchy();

    const treemap = d3.treemap()
        .size([width, height])
        .paddingOuter(3)
        .paddingInner(2)
        .round(true);

    treemap(root);

    const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

    const nodes = svg.selectAll('g')
        .data(root.descendants())
        .join('g')
        .attr('transform', d => `translate(${d.x0},${d.y0})`);

    nodes.append('rect')
        .attr('width', d => d.x1 - d.x0)
        .attr('height', d => d.y1 - d.y0)
        .attr('fill', d => {
            if (d.depth === 0) return 'transparent';
            return colorScale(d.data.name);
        })
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .attr('opacity', d => d.data.isChannel ? 0.9 : 0.8)
        .style('cursor', 'pointer')
        .on('click', function (event, d) {
            if (d.depth === 0) return;

            if (d.data.isCountry) {
                state.selectedCountry = d.data.name;
                renderTreemap();
            } else if (d.data.isCategory) {
                state.selectedCategory = d.data.name;
                renderTreemap();
            }
        });

    nodes.filter(d => d.data.isChannel)
        .append('image')
        .attr("xlink:href", d => `/proxy?url=${encodeURIComponent(d.data.data?.thumbnail || '')}`)
        .attr('width', d => d.x1 - d.x0)
        .attr('height', d => d.y1 - d.y0)
        .attr('preserveAspectRatio', 'xMidYMid slice')
        .style('opacity', 0.7)
        .style('cursor', 'pointer')
        .on('error', function () {
            d3.select(this).remove();
        });

    nodes.filter(d => d.data.isChannel)
        .append('rect')
        .attr('width', d => d.x1 - d.x0)
        .attr('height', d => d.y1 - d.y0)
        .attr('fill', 'rgba(0,0,0,0.3)')
        .style('cursor', 'pointer');

    nodes.filter(d => d.data.isCountry || d.data.isCategory)
        .append('text')
        .attr('x', d => (d.x1 - d.x0) / 2)
        .attr('y', d => (d.y1 - d.y0) / 2)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .text(d => d.data.name)
        .attr('font-size', d => {
            const width = d.x1 - d.x0;
            const height = d.y1 - d.y0;
            const minDim = Math.min(width, height);
            return Math.max(12, Math.min(24, minDim / 8)) + 'px';
        })
        .attr('font-weight', 'bold')
        .attr('fill', '#fff')
        .style('pointer-events', 'none')
        .style('text-shadow', '2px 2px 4px rgba(0,0,0,0.8)');

    nodes.filter(d => d.data.isCountry || d.data.isCategory)
        .append('text')
        .attr('x', d => (d.x1 - d.x0) / 2)
        .attr('y', d => (d.y1 - d.y0) / 2 + 20)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .text(d => formatNumber(d.value) + ' abonnés')
        .attr('font-size', '12px')
        .attr('fill', '#fff')
        .style('pointer-events', 'none')
        .style('text-shadow', '1px 1px 3px rgba(0,0,0,0.8)');
}

export {renderTreemap};
