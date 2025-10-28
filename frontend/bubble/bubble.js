import pipeline from "../index.js";
import {baseCountryCodeToFullName} from "../utils/utils.js";

let currentView = 'countries';
let currentCountry = null;
let currentYoutuber = null;
let videosData = [];

let svg;
let bubblesGroup;
let tooltip;
let width;
let height;

d3.csv('data/youtube_videos.csv').then(data => {
    data.forEach(d => {
        d.view_count = +d.view_count || 0;
        d.like_count = +d.like_count || 0;
        d.comment_count = +d.comment_count || 0;
    });
    videosData = data;
});

function initializeSVG() {
    const pipelineData = pipeline.run();
    const container = document.getElementById('svg');
    container.innerHTML = '';

    const rect = container.getBoundingClientRect();
    width = rect.width;
    height = rect.height;

    svg = d3.select('#svg')
        .append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
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

    const titleGroup = svg.append('g')
        .attr('class', 'title-group');

    titleGroup.append('text')
        .attr('class', 'chart-title')
        .attr('x', width / 2)
        .attr('y', 30)
        .attr('text-anchor', 'middle')
        .attr('font-size', '24px')
        .attr('font-weight', 'bold')
        .attr('fill', '#2d3748')
        .text('YouTubeurs par Pays');

    bubblesGroup = svg.append('g')
        .attr('class', 'bubbles-group');

    tooltip = d3.select('body').append('div')
        .attr('class', 'bubble-tooltip')
        .style('position', 'absolute')
        .style('padding', '10px')
        .style('background', 'rgba(0, 0, 0, 0.8)')
        .style('color', 'white')
        .style('border-radius', '5px')
        .style('pointer-events', 'none')
        .style('opacity', 0)
        .style('font-size', '12px')
        .style('z-index', '1000');

    return pipelineData;
}

function handleBackButtonClick() {
    if (currentView === 'videos')
        showYoutubers(currentCountry);
    else if (currentView === 'youtubers')
        showCountries();
}

function showCountries() {
    const pipelineData = pipeline.run();
    currentView = 'countries';
    currentCountry = null;

    svg.select('.back-button').style('display', 'none');
    svg.select('.chart-title').text('YouTubeurs par Pays');
    svg.selectAll('.youtuber-node').remove();

    const countryData = d3.rollup(
        pipelineData,
        v => v.length,
        d => d.country || 'Unknown'
    );

    const countryArray = Array.from(countryData, ([country, count]) => ({
        country,
        count
    })).filter(d => d.country !== 'Unknown');

    const root = d3.hierarchy({children: countryArray})
        .sum(d => d.count)
        .sort((a, b) => b.value - a.value);

    const pack = d3.pack()
        .size([width, height - 60])
        .padding(5);

    pack(root);

    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
    const t = svg.transition().duration(500);

    const nodes = bubblesGroup.selectAll('g.country-node')
        .data(root.leaves(), d => d.data.country);

    nodes.exit()
        .transition(t)
        .attr('transform', _ => `translate(${width / 2},${height / 2})`)
        .style('opacity', 0)
        .remove();

    const nodesEnter = nodes.enter()
        .append('g')
        .attr('class', 'country-node')
        .attr('transform', `translate(${width / 2},${height / 2})`)
        .style('cursor', 'pointer')
        .style('opacity', 0);

    nodesEnter.append('circle')
        .attr('r', 0)
        .attr('fill', (d, i) => colorScale(i))
        .attr('opacity', 0.7)
        .attr('stroke', '#fff')
        .attr('stroke-width', 2);

    nodesEnter.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '-0.2em')
        .attr('font-size', 0)
        .attr('font-weight', 'bold')
        .attr('fill', '#2d3748')
        .text(d => baseCountryCodeToFullName(d.data.country));

    nodesEnter.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '1.2em')
        .attr('font-size', 0)
        .attr('fill', '#4a5568')
        .text(d => `${d.data.count} YouTubeurs`);

    const nodesUpdate = nodesEnter.merge(nodes);

    nodesUpdate
        .transition(t)
        .attr('transform', d => `translate(${d.x},${d.y + 50})`)
        .style('opacity', 1);

    nodesUpdate.select('circle')
        .transition(t)
        .attr('r', d => d.r);

    nodesUpdate.selectAll('text')
        .transition(t)
        .attr('font-size', d => Math.min(d.r / 3, 16));

    nodesUpdate
        .on('mouseenter', (event, d) => {
            d3.select(this).select('circle')
                .transition()
                .duration(200)
                .attr('opacity', 1)
                .attr('stroke-width', 3);

            tooltip
                .style('opacity', 1)
                .html(`<strong>${d.data.country}</strong><br/>${d.data.count} YouTubeurs`)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
        .on('mousemove', () => {
            tooltip
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseleave', () => {
            d3.select(this).select('circle')
                .transition()
                .duration(200)
                .attr('opacity', 0.7)
                .attr('stroke-width', 2);

            tooltip.style('opacity', 0);
        })
        .on('click', (event, d) => {
            tooltip.style('opacity', 0);
            showYoutubers(d.data.country);
        });
}

function showYoutubers(country) {
    pipeline.addOperation('countryFilter', data => data.filter(d => d.country === country));
    document.querySelectorAll(".multi-select-item").forEach(item => {
        if (item.textContent === country) {
            item.querySelector("input").checked = true;
        }
    });

    const pipelineData = pipeline.run();
    currentView = 'youtubers';
    currentCountry = country;

    svg.select('.back-button').style('display', 'block');
    svg.select('.chart-title').text(`YouTubeurs - ${baseCountryCodeToFullName(country)}`);
    svg.selectAll('.video-node').remove();

    const root = d3.hierarchy({children: pipelineData})
        .sum(d => +d.subscriber_count || 1)
        .sort((a, b) => b.value - a.value);

    if (root.children.length > 200) {
        root.children = root.children.slice(0, 200);
    }

    const pack = d3.pack()
        .size([width, height - 60])
        .padding(3);

    pack(root);

    const t = svg.transition().duration(750);

    const nodes = bubblesGroup.selectAll('g.youtuber-node')
        .data(root.leaves(), d => d.data.channel_id);

    nodes.exit()
        .transition(t)
        .attr('transform', _ => `translate(${width / 2},${height / 2})`)
        .style('opacity', 0)
        .remove();

    bubblesGroup.selectAll('g.country-node')
        .transition(t)
        .attr('transform', `translate(${width / 2},${height / 2})`)
        .style('opacity', 0)
        .remove();

    const nodesEnter = nodes.enter()
        .append('g')
        .attr('class', 'youtuber-node')
        .attr('transform', `translate(${width / 2},${height / 2})`)
        .style('cursor', 'pointer')
        .style('opacity', 0);

    nodesEnter.append('clipPath')
        .attr('id', d => `clip-${d.data.channel_id}`)
        .append('circle')
        .attr('r', 0)
        .attr('cx', 0)
        .attr('cy', 0);

    nodesEnter.append('image')
        .attr('xlink:href', d => `/proxy?url=${encodeURIComponent(d.data.thumbnail || '')}`)
        .attr('clip-path', d => `url(#clip-${d.data.channel_id})`)
        .attr('x', d => -d.r)
        .attr('y', d => -d.r)
        .attr('width', d => 2 * d.r)
        .attr('height', d => 2 * d.r)
        .attr('preserveAspectRatio', 'xMidYMid slice')
        .attr('opacity', 0.9);

    nodesEnter.append('circle')
        .attr('r', 0)
        .attr('fill', 'none')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.9);

    const nodesUpdate = nodesEnter.merge(nodes);

    nodesUpdate
        .transition(t)
        .attr('transform', d => `translate(${d.x},${d.y + 50})`)
        .style('opacity', 1);

    nodesUpdate.select('circle')
        .transition(t)
        .attr('r', d => d.r);

    nodesUpdate.select('text')
        .transition(t)
        .attr('font-size', d => Math.min(2 * d.r / d.data.channel_name.length, 12))
        .text(d => {
            const name = d.data.channel_name;
            const maxLen = Math.floor(d.r / 3);
            return name.length > maxLen ? name.substring(0, maxLen) + '...' : name;
        });

    nodesUpdate
        .on('mouseenter', (event, d) => {
            d3.select(this).select('circle')
                .transition()
                .duration(200)
                .attr('opacity', 1)
                .attr('stroke-width', 2);

            const subs = (+d.data.subscriber_count).toLocaleString('fr-FR');
            const category = d.data.category || 'Non catégorisé';

            tooltip
                .style('opacity', 1)
                .html(`<strong>${d.data.channel_name}</strong><br/>Catégorie: ${category}<br/>Abonnés: ${subs}`)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
        .on('mousemove', () => {
            tooltip
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseleave', () => {
            d3.select(this).select('circle')
                .transition()
                .duration(200)
                .attr('opacity', 0.7)
                .attr('stroke-width', 1);

            tooltip.style('opacity', 0);
        })
        .on('click', (event, d) => {
            tooltip.style('opacity', 0);
            currentYoutuber = d.data;
            showVideos();
        });
}

function showVideos() {
    let youtuber = currentYoutuber;
    currentView = 'videos';

    svg.select('.back-button').style('display', 'block');

    const data = videosData.filter(v => v.channel_id === youtuber.channel_id);
    if (data.length === 0) {
        alert("Aucune vidéo trouvée pour ce YouTubeur.");
        return;
    }

    const root = d3.hierarchy({children: data})
        .sum(d => +d.view_count || 1)
        .sort((a, b) => b.value - a.value);

    const pack = d3.pack()
        .size([width - 60, height - 120])
        .padding(4);
    pack(root);

    const t = svg.transition().duration(750);

    bubblesGroup.selectAll('g.youtuber-node')
        .transition(t)
        .attr('transform', `translate(${width / 2},${height / 2})`)
        .style('opacity', 0)
        .remove();

    const nodes = bubblesGroup.selectAll('g.video-node')
        .data(root.leaves(), d => d.data.video_id);

    nodes.exit().remove();

    const nodesEnter = nodes.enter()
        .append('g')
        .attr('class', 'video-node')
        .attr('transform', `translate(${width / 2},${height / 2})`)
        .style('cursor', 'pointer')
        .style('opacity', 0);

    nodesEnter.append('clipPath')
        .attr('id', d => `clip-video-${d.data.video_id}`)
        .append('circle')
        .attr('r', 0);

    nodesEnter.append('image')
        .attr('xlink:href', d => `/proxy?url=${encodeURIComponent(d.data.thumbnail || '')}`)
        .attr('clip-path', d => `url(#clip-video-${d.data.video_id})`)
        .attr('x', d => -d.r)
        .attr('y', d => -d.r)
        .attr('width', d => 2 * d.r)
        .attr('height', d => 2 * d.r)
        .attr('preserveAspectRatio', 'xMidYMid slice')
        .attr('opacity', 0.9);

    nodesEnter.append('circle')
        .attr('r', 0)
        .attr('fill', 'none')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.9);

    const nodesUpdate = nodesEnter.merge(nodes);

    nodesUpdate.transition(t)
        .attr('transform', d => `translate(${d.x},${d.y + 50})`)
        .style('opacity', 1);

    nodesUpdate.select('circle').transition(t)
        .attr('r', d => d.r);

    nodesUpdate
        .on('mouseenter', (event, d) => {
            d3.select(this).select('circle')
                .transition().duration(200)
                .attr('stroke-width', 2);

            tooltip
                .style('opacity', 1)
                .html(`
            <strong>${d.data.title}</strong><br/>
            Vues: ${(+d.data.view_count).toLocaleString('fr-FR')}<br/>
            Likes: ${(+d.data.like_count).toLocaleString('fr-FR')}<br/>
            Commentaires: ${(+d.data.comment_count).toLocaleString('fr-FR')}<br/>
            Publié: ${d.data.published_date}
        `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
        .on('mousemove', () => {
            tooltip
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseleave', () =>
            tooltip.style('opacity', 0))
        .on('click', (event, d) =>
            window.open(`https://www.youtube.com/watch?v=${d.data.video_id}`, '_blank')
        );
}


function renderBubbleChart() {
    initializeSVG();
    if (currentView === 'countries')
        showCountries();
    else if (currentView === 'youtubers')
        showYoutubers(currentCountry);
    else
        showVideos();
}

export {renderBubbleChart};
