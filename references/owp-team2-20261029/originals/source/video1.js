import _ from '@lodash';
import { withStyles } from '@material-ui/core/styles';
import React from 'react';
import { BigPlayButton, ControlBar, Player } from 'video-react';
import { query } from '@owp/api';
import { Animated } from 'react-animated-css';
import './video.css';
import DonutChart from './donut-chart';
/*
    Location    : 실시간 공정현황>3D 영상
    Deacriptin  : 영상화면1
    FileName    : video.js
    Author      : sy.oh
    Date        : 2020.04.09
    Work        : 영상 중 [ICA1~3, X-ray1~3] 공정 부분을 매핑함.
    Work1       : 5층~7층에 있던 희창유업 생산팀 실적현황을 해당 js 파일로 이동 함.
    Work2       : 생산2팀에 대한 ICA1호기 , ICA2호기 ICA3호기를 맵핑 함. 
*/

const styles = (theme) => ({
    popover: {
        pointerEvents: 'none',
    },
    paper: {
        padding: theme.spacing.unit,
    },
});

const sources = {
    pellerar: '/assets/models/heechang_0529.webm',
};

class Video0 extends React.Component {
    constructor(props, context) {
        super(props, context);

        this.state = {
            source: sources.pellerar,
            showlabel: false,
        };

        this.play = this.play.bind(this);
        this.pause = this.pause.bind(this);
        this.load = this.load.bind(this);
        this.changeCurrentTime = this.changeCurrentTime.bind(this);
        this.seek = this.seek.bind(this);
    }

    numberFormat(inputNumber) {
        return inputNumber.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    componentDidMount() {
        // subscribe state change
        this.player.subscribeToStateChange(this.handleStateChange.bind(this));

        const innerWidth = window.innerWidth;
        //console.log('innerWidth',innerWidth);
        this.setState({ innerWidth: innerWidth });
        this.setState({ zoomRatio: (innerWidth / 1920) * 100 });
        this.datatotal(); //현황판 집계

        //현황판 집계
        const datatotal = () => {
            if (this.props.play)
                //영상시작이 되면
                this.datatotal(); //데이터 호출
        };

        //현황판 집계
        this.datatotalLoop = setInterval(function () {
            datatotal();
        }, 5000);
    }

    //현황판 집계
    datatotal = () => {
        query({
            url: '/listOWP_C402060_MAIN_VI2',
            params: {
                jsondata: JSON.stringify({
                    'OWP_C402060_MAIN_VI.WORK_AREA': 'D028029',
                }),
            },
        }).then((res) => {
            /*if (!!res) {
                res.map((item, i) => {
                    var regexp = /\B(?=(\d{3})+(?!\d))/g;
                    this.setState({
                        [i + 1 + '_PROD']: !!item['OWP_C402060_MAIN_VI.PROD_NM']
                            ? item['OWP_C402060_MAIN_VI.PROD_NM']
                            : '-', //제품명
                        [i + 1 + '_PROD_RESULT_QTY']: !!item['OWP_C402060_MAIN_VI.PROD_RESULT_QTY']
                            ? Number(item['OWP_C402060_MAIN_VI.PROD_RESULT_QTY'])
                                  .toFixed(0)
                                  .toString()
                                  .replace(regexp, ',')
                            : 0, //현재실적 (데이터없을때 0)
                        [i + 1 + '_WORK_PLAN_QTY']: !!item['OWP_C402060_MAIN_VI.WORK_PLAN_QTY']
                            ? Number(item['OWP_C402060_MAIN_VI.WORK_PLAN_QTY'].replace(',', ''))
                                  .toFixed(0)
                                  .toString()
                                  .replace(regexp, ',')
                            : 0, //금일목표
                        [i + 1 + '_USERNAME']: !!item['OWP_C402060_MAIN_VI.USERNAME']
                            ? item['OWP_C402060_MAIN_VI.USERNAME']
                            : '-', //작업자
                        [i + 1 + '_Ache']: !!item['OWP_C402060_MAIN_VI.PROD_RESULT_QTY']
                            ? Number(
                                  (item['OWP_C402060_MAIN_VI.PROD_RESULT_QTY'] /
                                      item['OWP_C402060_MAIN_VI.WORK_PLAN_QTY'].replace(',', '')) *
                                      100
                              ).toFixed(0)
                            : 0, //달성율 (실적 / 금일목표에서 , 제거한 값 * 100) 을 세자리까지 나타내기
                        [i + 1 + '_WORK_START_TIME']: item['OWP_C402060_MAIN_VI.WORK_START_TIME'], //시작시간
                    });
                    // }
                });
            }*/
        });

        query({
            url: '/selectC101000Monitering_MACHBASE4',
            params: {
                jsondata: JSON.stringify({
                    ICA1_START_TIME: this.state['1_WORK_START_TIME'],
                    ICA2_START_TIME: this.state['2_WORK_START_TIME'],
                    ICA3_START_TIME: this.state['3_WORK_START_TIME'],
                    JIDAE_START_TIME: this.state['4_WORK_START_TIME'],
                }),
            },
        })
            .then((res) => {
                res.map((item) => {
                    if (_.includes(item.tid, 'ICA')) {
                        var regexp = /\B(?=(\d{3})+(?!\d))/g; //세자리마다 ","찍는 정규식
                        this.setState({
                            [item.tid + '_Value']: Number(item.value.replace(',', ''))
                                .toFixed(0)
                                .toString()
                                .replace(regexp, ','), //데이터 값 (양품/불량 카운트 값)
                            [item.tid + '_Name']: item.tid, //구분값
                            [item.tid + '_Work']: item.workproc, //공정라인
                        });
                    }
                });
                this.setState({
                    datatotal: res,
                });
            })
            .catch((error) => console.error('error...', error));
    };

    componentWillUnmount() {
        clearInterval(this.datatotalLoop); //현황판 집계
    }

    showlabel = false;
    paused = true;
    componentDidUpdate(prevProps, prevState, snapshot) {
        if (this.state.player) {
            if (this.props.play === true && this.state.player.currentTime === 0) {
                this.play();
                this.paused = false;
                this.showlabel = false;
            }

            if (this.props.play === false && this.state.player.currentTime > 0) {
                //this.seek(0);
                this.player.seek(0);
                this.player.pause();
                console.log('this.player.pause()');
                this.paused = true;
                this.showlabel = false;
            }

            if (this.showlabel === true && this.state.showlabel === false) {
                this.setState({ showlabel: true });
            } else if (this.showlabel === false && this.state.showlabel === true) {
                this.setState({ showlabel: false });
            }

            if (
                this.props.play === true &&
                this.showlabel === false &&
                this.state.player.currentTime > 3
            ) {
                this.showlabel = true;
                this.setState({ showlabel: true });
            }

            if (
                this.showlabel === true &&
                this.state.showlabel === true &&
                this.state.player.currentTime > 9.9
            ) {
                this.player.seek(3);
            }

            // if(this.state.player.duration===this.state.player.currentTime){
            //     this.seek(0);
            //     this.play();
            //     this.showlabel = false ;
            // }
        }
    }

    setMuted(muted) {
        return () => {
            this.player.muted = muted;
        };
    }

    handleStateChange(state) {
        // copy player state to this component's state
        this.setState({
            player: state,
            //currentTime: state.currentTime
        });
    }

    play() {
        this.player.play();
    }

    pause() {
        this.player.pause();
    }

    load() {
        this.player.load();
    }

    changeCurrentTime(seconds) {
        return () => {
            const { player } = this.player.getState();
            this.player.seek(player.currentTime + seconds);
        };
    }

    seek(seconds) {
        return () => {
            this.player.seek(seconds);
        };
    }

    render() {
        return (
            <React.Fragment>
                <div style={{ position: 'relative', width: `${this.state.innerWidth}px` }}>
                    <Player
                        ref={(player) => {
                            this.player = player;
                        }}
                        //autoPlay
                        muted
                        //loop
                        LoadingSpinner={null}
                    >
                        <source src={this.state.source} />
                        <ControlBar
                            disableDefaultControls={true}
                            autoHide={true}
                            autoHideTime={1}
                        />
                        <BigPlayButton position="center" />
                    </Player>

                    <div
                        className="Light"
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            zoom: `${this.state.zoomRatio}%`,
                        }}
                    >
                        <Animated
                            animationIn="fadeIn"
                            animationOut="fadeOut"
                            animationInDuration={1500}
                            animationOutDuration={800}
                            animateOnMount={false}
                            isVisible={this.state.showlabel}
                        >
                            <div className="_C101000_table">
                                <div className="_C101000_table_show">
                                    {/* <p>희창유업 생산팀 메인화면</p> */}
                                </div>
                            </div>
                        </Animated>
                    </div>
                </div>
            </React.Fragment>
        );
    }
}

export default withStyles(styles)(Video0);
