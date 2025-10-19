import pipeline from "../index.js";

// État de l'application
const state = {
    groupBy: 'country', // 'country', 'category', 'none'
    selectedGroup: null
};

function formatNumber(num) {
    num = Number(num) || 0;
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toString();
}

function prepareHierarchy() {
    let data = pipeline.data;

    // Filtrer selon la sélection
    if (state.selectedGroup) {
        if (state.groupBy === 'country') {
            data = data.filter(d => d.country === state.selectedGroup);
        } else if (state.groupBy === 'category') {
            data = data.filter(d => d.category === state.selectedGroup);
        }
    }

    // Limiter à top 100 pour performance
    data = data
        .sort((a, b) => (+b.subscriber_count || 0) - (+a.subscriber_count || 0))
        .slice(0, 100);

    // Créer la hiérarchie
    let hierarchy;

    if (state.groupBy === 'country' && !state.selectedGroup) {
        hierarchy = {
            name: "root",
            children: Array.from(
                d3.group(data, d => d.country || 'Unknown'),
                ([country, channels]) => ({
                    name: country,
                    children: channels.map(c => ({
                        name: c.channel_name,
                        value: +c.subscriber_count || 1,
                        data: c
                    }))
                })
            )
        };
    } else if (state.groupBy === 'category' && !state.selectedGroup) {
        hierarchy = {
            name: "root",
            children: Array.from(
                d3.group(data, d => d.category || 'Unknown'),
                ([category, channels]) => ({
                    name: category,
                    children: channels.map(c => ({
                        name: c.channel_name,
                        value: +c.subscriber_count || 1,
                        data: c
                    }))
                })
            )
        };
    } else {
        hierarchy = {
            name: "root",
            children: data.map(c => ({
                name: c.channel_name,
                value: +c.subscriber_count || 1,
                data: c
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

    // Dimensions
    const width = container.clientWidth || 1400;
    const height = 800;

    // Créer le SVG
    const svg = d3.select('#svg')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .style('font-family', 'Arial, sans-serif');

    // Préparer les données
    const root = prepareHierarchy();

    // Créer le treemap
    const treemap = d3.treemap()
        .size([width, height])
        .paddingOuter(3)
        .paddingTop(state.groupBy !== 'none' && !state.selectedGroup ? 20 : 3)
        .paddingInner(2)
        .round(true);

    treemap(root);

    // Palette de couleurs
    const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

    // Groupes pour chaque nœud
    const nodes = svg.selectAll('g')
        .data(root.descendants())
        .join('g')
        .attr('transform', d => `translate(${d.x0},${d.y0})`);

    // Rectangles de fond
    nodes.append('rect')
        .attr('width', d => d.x1 - d.x0)
        .attr('height', d => d.y1 - d.y0)
        .attr('fill', d => {
            if (d.depth === 0) return 'transparent';
            if (d.depth === 1) return colorScale(d.data.name);
            return colorScale(d.parent.data.name);
        })
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .attr('opacity', d => d.depth === 1 ? 0.3 : 0.9)
        .style('cursor', d => d.depth > 0 ? 'pointer' : 'default')
        .on('click', function (event, d) {
            if (d.depth === 1 && !state.selectedGroup) {
                state.selectedGroup = d.data.name;
                renderTreemap();
            }
        });

    // Images (thumbnails) pour les feuilles
    nodes.filter(d => d.depth === root.height)
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

    // Overlay semi-transparent pour meilleure lisibilité du texte
    nodes.filter(d => d.depth === root.height)
        .append('rect')
        .attr('width', d => d.x1 - d.x0)
        .attr('height', d => d.y1 - d.y0)
        .attr('fill', 'rgba(0,0,0,0.3)')
        .style('cursor', 'pointer');

    // Labels pour les groupes (depth 1)
    nodes.filter(d => d.depth === 1)
        .append('text')
        .attr('x', 4)
        .attr('y', 15)
        .text(d => d.data.name)
        .attr('font-size', '14px')
        .attr('font-weight', 'bold')
        .attr('fill', '#fff')
        .style('pointer-events', 'none');

    // Ajouter les contrôles
    addControls();
}

function addControls() {
    const existingControls = document.querySelector('.treemap-controls');
    if (existingControls) existingControls.remove();

    const container = document.getElementById('svg');
    const controls = document.createElement('div');
    controls.className = 'treemap-controls';

    let breadcrumb = '';
    if (state.selectedGroup) {
        breadcrumb = `<span class="breadcrumb-text">
            ${state.groupBy === 'country' ? '🌍' : '🏷️'} ${state.selectedGroup}
        </span>`;
    }

    controls.innerHTML = `
        <div class="controls-row">
            <div class="controls-left">
                <button class="control-btn ${state.groupBy === 'country' && !state.selectedGroup ? 'active' : ''}" 
                        onclick="setGroupBy('country')">
                    Par Pays
                </button>
                <button class="control-btn ${state.groupBy === 'category' && !state.selectedGroup ? 'active' : ''}" 
                        onclick="setGroupBy('category')">
                    Par Catégorie
                </button>
                ${breadcrumb}
            </div>
            <div class="controls-right">
                ${state.selectedGroup ?
        '<button class="control-btn-back" onclick="resetTreemap()">← Retour</button>' :
        '<button class="control-btn-reset" onclick="resetTreemap()">Reset</button>'
    }
            </div>
        </div>
    `;

    container.insertBefore(controls, container.firstChild);
}

// Fonctions globales
window.setGroupBy = function (groupBy) {
    state.groupBy = groupBy;
    state.selectedGroup = null;
    renderTreemap();
};

window.resetTreemap = function () {
    state.groupBy = 'country';
    state.selectedGroup = null;
    renderTreemap();
};

export {renderTreemap};
