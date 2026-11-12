import * as am4core from "@amcharts/amcharts4/core";
import * as am4charts from "@amcharts/amcharts4/charts";
import am4themes_animated from "@amcharts/amcharts4/themes/animated";
import isEmpty from 'lodash/isEmpty';
import React, { useEffect, useState } from 'react';
import uniqueId from 'lodash/uniqueId';

/*
    Location    : 파이차트 구현
    Deacriptin  : 파이차트 구현
    FileName    : donut-chart.js
    Author      : mj.kim
    Date        : 2020.06.23
    Work        : 파이차트 구현.
*/

am4core.useTheme(am4themes_animated);
am4core.options.commercialLicense = true;

function DonutChart ({id,data}){
    const [chart, setChart] = useState();
    
    //초기 차트생성
    useEffect(() => {
        // Create chart instance
        const chart = am4core.create(id, am4charts.PieChart);
        // Set inner radius
        chart.innerRadius = am4core.percent(50);
        // Add data
        chart.data = [] ; //데이터의 값을 배열로 받아온다.

        // Add and configure Series
        let pieSeries = chart.series.push(new am4charts.PieSeries());
        pieSeries.dataFields.value = "value"; //카운트의 값
        console.log("pieSeries.dataFields.value", pieSeries.dataFields.value)
        pieSeries.dataFields.category = "tid"; //팀명

        pieSeries.slices.template.stroke = am4core.color("#fff");
        pieSeries.slices.template.strokeWidth = 2;
        pieSeries.slices.template.strokeOpacity = 1;

        // This creates initial animation
        pieSeries.hiddenState.properties.opacity = 1;
        pieSeries.hiddenState.properties.endAngle = -90;
        pieSeries.hiddenState.properties.startAngle = -90;   

        setChart(chart);

        return () => {
            chart.dispose();
        };
    } , [id]);

    useEffect(() => {
    if (!isEmpty(chart) && !!data ) {
        chart.data = data ;
    }
    }, [chart, data ]);
    
    return <div id={id} style={{ height: '100%' }} />;
}

DonutChart.defaultProps = {
    id: `guage-chart-${uniqueId()}`,
    data: 0,
};

export default DonutChart;
