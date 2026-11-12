import _ from '@lodash';
import { withStyles } from '@material-ui/core/styles';
import { query } from '@owp/api';
import React from 'react';
import { Animated } from 'react-animated-css';
//import Clock from 'react-live-clock';
import { BigPlayButton, ControlBar, Player } from 'video-react';
import './video.css';
import GuageChart from './chart_guage';

/*
    Location    : 실시간 공정현황>3D 영상
    Deacriptin  : 영상화면1
    FileName    : video.js
    Author      : sy.oh
    Date        : 2020.04.09
    Work        : 영상 중 [ICA1~3, X-ray1~3] 공정 부분을 매핑함.
    Work1       : 디자인 수정 및 게이지 차트 적용 (MJKIM)
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
    pellerar: '/assets/models/heechang_0428_3FCloseup.webm',
};

class Video3 extends React.Component {
    constructor(props, context) {
        super(props, context);

        this.state = {
            source: sources.pellerar,
            lineRun: 0,
            lineIdle: 0,
            lineStop: 0,
            lineOff: 0,
            anchorEl: null,
            erpData: {},
            showlabel: false,
            //상한치, 하안치 관련
            usl: 0,
            lsl: 0,
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

    dataLoad = () => {
        let result = {};
        query({
            url: '/selectC101000Monitering_MACHBASE',
            params: {
                jsondata: '{}',
            },
        })
            .then((res) => {
                result = res;
                result.map((item) => {
                    if (_.includes(item.TID, 'DRYER_')) {
                        let _value = Math.abs(Number(item.VALUE));
                        _value = _value.toFixed(3);
                        this.setState({
                            [item.TID + '_Value']: this.numberFormat(_value),
                            [item.TID + '_Name']: item.SENSORNM,
                            //상한치, 하안치 값1
                            [item.TID + '_USL1']: Number(item.USL1),
                            [item.TID + '_LSL1']: Number(item.LSL1),
                            [item.TID + '_TIMESTAMP']: item.TIMESTAMP,
                            [item.TID + '_TID']: item.TID,
                        });
                    }
                });
            })
            .catch((error) => console.error('error...', error));
    };

    dataLoadLoop = null;
    componentDidMount() {
        // subscribe state change
        this.player.subscribeToStateChange(this.handleStateChange.bind(this));

        const innerWidth = window.innerWidth;
        //console.log('innerWidth',innerWidth);
        this.setState({ innerWidth: innerWidth });
        this.setState({ zoomRatio: (innerWidth / 1920) * 100 });

        this.dataLoad();

        const dataLoad = () => {
            if (this.props.play) this.dataLoad();
        };
        this.dataLoadLoop = window.setInterval(() => {
            dataLoad();
        }, 2000);
    }

    componentWillUnmount() {
        clearInterval(this.dataLoadLoop);
    }

    showlabel = false;
    paused = true;
    componentDidUpdate(prevProps, prevState, snapshot) {
        if (this.state.player) {
            // console.log(this.state.player.currentTime);
            // console.log('this.showlabel',this.showlabel);
            // console.log('this.state.showlabel',this.state.showlabel);
            // console.log('this.props.play',this.props.play);
            // console.log('this.paused',this.paused);

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
                this.state.player.currentTime > 8.9
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

    settingBubble = (Euq) => {
        //데이터에 올렸을때 테이블 표시하기
        this.setState({
            ['bubble' + Euq]: true,
            saveEuqTime: this.state[Euq + '_TIMESTAMP'],
        });
    };

    resetBubble = (Euq) => {
        //내렸을때 테이블 닫기
        this.setState({
            ['bubble' + Euq]: false,
            saveEuqTime: '',
        });
    };

    //20200619 작업
    render() {
        const drawTable = (
            <table
                className="blueTable2"
                style={{
                    marginLeft: '120px',
                    marginTop: '-100px',
                }}
            >
                <tbody>
                    <tr>
                        <td>{this.state.saveEuqTime}</td>
                    </tr>
                </tbody>
            </table>
        );
        return (
            <React.Fragment>
                <div style={{ position: 'relative', width: `${this.state.innerWidth}px` }}>
                    <Player
                        ref={(player) => {
                            this.player = player;
                        }}
                        // autoPlay
                        muted
                        // loop
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
                            <div className="clock">

                            </div>
                            {/*해당설비 위치 넘버링 작업*/}
                            <div className="OP-VAL-DRYER_E403PV_N number n01100">
                                <p className="numbervalue">{/*1*/}</p> {/*CCP-1B 원액온도*/}
                            </div>
                            <div className="OP-VAL-DRYER_HOLDING_TIME_N number n02100">
                                <p className="numbervalue">{/*2*/}</p> {/*홀딩시간*/}
                            </div>
                            <div className="OP-VAL-DRYER_E209PV_N number n03100">
                                <p className="numbervalue">{/*3*/}</p> {/*노즐원액압력*/}
                            </div>
                            <div
                                className="OP-VAL-DRYER_E401PV_N number n04100"
                                onClick={() => {
                                    if (
                                        document.getElementById('detailSensor').style.display ==
                                        'none'
                                    ) {
                                        document.getElementById('detailSensor').style.display =
                                            'block';
                                    } else {
                                        document.getElementById('detailSensor').style.display =
                                            'none';
                                    }
                                }}
                            >
                                <p className="numbervalue">{/*4*/}</p> {/*살균기 온도(통과 전)*/}
                            </div>
                            <div className="OP-VAL-DRYER_E319PV_N number n05100">
                                <p className="numbervalue">{/*5*/}</p> {/*FEED TANK LEVEL*/}
                            </div>
                            <div
                                className="OP-VAL-DRYER_DETAIL_N number n06100"
                                onClick={
                                    //버튼 클릭시, 원액공급 압력 및 살균후 온도를 보여 주는 함수
                                    () => {
                                        if (
                                            document.getElementById('detailSensor1').style
                                                .display == 'none'
                                        ) {
                                            document.getElementById('detailSensor1').style.display =
                                                'block';
                                            document.getElementById(
                                                'effectSensor'
                                            ).style.transform = 'translateZ(0px)';
                                        } else {
                                            document.getElementById('detailSensor1').style.display =
                                                'none';
                                            document.getElementById(
                                                'effectSensor'
                                            ).style.transform = 'translateZ(0px)';
                                        }
                                    }
                                }
                            >
                                <p className="numbervalue">{/*6*/}</p> {/*균질기 정보 조회*/}
                            </div>
                            {/*설비위치 넘버링 매칭 후, 게이지 차트 적용 div로 레이아웃 잡으려 했으나, 적용이 안되서 일단 TABLE 적용*/}
                            <div className="_C101000_table_3">
                                {/*해당 넘버링 하단에 게이지 차트 적용*/}

                                {/*CCP-1B 원액온도*/}
                                <div className="OP-VAL-DRYER_E403PV labelvalue_1_glass">
                                    <div
                                        className="GuageChart"
                                        onMouseOver={() => {
                                            this.settingBubble(this.state['DRYER_E403PV_TID']);
                                        }}
                                        onMouseOut={() => {
                                            this.resetBubble(this.state['DRYER_E403PV_TID']);
                                        }}
                                    >
                                        <GuageChart
                                            id="DRYER_E403PV_GuageChart"
                                            data={{
                                                val: this.state['DRYER_E403PV_Value'],
                                                usl: this.state['DRYER_E403PV_USL1'],
                                                lsl: this.state['DRYER_E403PV_LSL1'],
                                            }}
                                        />
                                    </div>
                                    <div className="valpos">
                                        <div className="val g">
                                            {this.state['DRYER_E403PV_Value']}
                                        </div>
                                        <div className="unit">℃</div>
                                        <div className="subtitle">(1) CCP-1B 원액온도</div>
                                    </div>
                                    {Boolean(this.state.bubbleDRYER_E403PV) && drawTable}
                                </div>

                                {/*홀딩시간*/}
                                <div className="OP-VAL-DRYER_HOLDING_TIME labelvalue_1_glass">
                                    <div
                                        className="GuageChart"
                                        onMouseOver={() => {
                                            this.settingBubble(
                                                this.state['DRYER_HOLDING_TIME_TID']
                                            );
                                        }}
                                        onMouseOut={() => {
                                            this.resetBubble(this.state['DRYER_HOLDING_TIME_TID']);
                                        }}
                                    >
                                        <GuageChart
                                            id="DRYER_HOLDING_TIME_GuageChart"
                                            data={{
                                                val: this.state['DRYER_HOLDING_TIME_Value'],
                                                usl: this.state['DRYER_HOLDING_TIME_USL1'],
                                                lsl: this.state['DRYER_HOLDING_TIME_LSL1'],
                                            }}
                                        />
                                    </div>
                                    <div className="valpos">
                                        <div className="val g">
                                            {this.state['DRYER_HOLDING_TIME_Value']}
                                        </div>
                                        <div className="unit">sec</div>
                                        <div className="subtitle">(2) 홀딩시간</div>
                                    </div>
                                    {Boolean(this.state.bubbleDRYER_HOLDING_TIME) && drawTable}
                                </div>

                                {/*노즐원액 압력*/}
                                <div className="OP-VAL-DRYER_E209PV labelvalue_1_glass">
                                    <div
                                        className="GuageChart"
                                        onMouseOver={() => {
                                            this.settingBubble(this.state['DRYER_E209PV_TID']);
                                        }}
                                        onMouseOut={() => {
                                            this.resetBubble(this.state['DRYER_E209PV_TID']);
                                        }}
                                    >
                                        <GuageChart
                                            id="DRYER_E209PV_GuageChart"
                                            data={{
                                                val: this.state['DRYER_E209PV_Value'],
                                                usl: this.state['DRYER_E209PV_USL1'],
                                                lsl: this.state['DRYER_E209PV_LSL1'],
                                            }}
                                        />
                                    </div>
                                    <div className="valpos">
                                        <div className="val g">
                                            {this.state['DRYER_E209PV_Value']}
                                        </div>
                                        <div className="unit">bar</div>
                                        <div className="subtitle">(3) 노즐원액 압력</div>
                                    </div>
                                    {Boolean(this.state.bubbleDRYER_E209PV) && drawTable}
                                </div>

                                {/*살균기 온도(통과전)*/}
                                <div className="OP-VAL-DRYER_E401PV labelvalue_1_glass">
                                    <div
                                        className="GuageChart"
                                        onMouseOver={() => {
                                            this.settingBubble(this.state['DRYER_E401PV_TID']);
                                        }}
                                        onMouseOut={() => {
                                            this.resetBubble(this.state['DRYER_E401PV_TID']);
                                        }}
                                    >
                                        <GuageChart
                                            id="DRYER_E401PV_GuageChart"
                                            data={{
                                                val: this.state['DRYER_E401PV_Value'],
                                                usl: this.state['DRYER_E401PV_USL1'],
                                                lsl: this.state['DRYER_E401PV_LSL1'],
                                            }}
                                        />
                                    </div>
                                    <div className="valpos">
                                        <div className="val g">
                                            {this.state['DRYER_E401PV_Value']}
                                        </div>
                                        <div className="unit">℃</div>
                                        <div className="subtitle">(4) 살균기 온도(통과전)</div>
                                    </div>
                                    {Boolean(this.state.bubbleDRYER_E401PV) && drawTable}
                                </div>

                                {/*탱크 온도*/}
                                <div className="OP-VAL-DRYER_E319PV labelvalue_1_glass">
                                    <div
                                        className="GuageChart"
                                        onMouseOver={() => {
                                            this.settingBubble(this.state['DRYER_E319PV_TID']);
                                        }}
                                        onMouseOut={() => {
                                            this.resetBubble(this.state['DRYER_E319PV_TID']);
                                        }}
                                    >
                                        <GuageChart
                                            id="DRYER_E319PV_GuageChart"
                                            data={{
                                                val: this.state['DRYER_E319PV_Value'],
                                                usl: this.state['DRYER_E319PV_USL1'],
                                                lsl: this.state['DRYER_E319PV_LSL1'],
                                            }}
                                        />
                                    </div>
                                    <div className="valpos">
                                        <div className="val g">
                                            {this.state['DRYER_E319PV_Value']}
                                        </div>
                                        <div className="unit">%</div>
                                        <div className="subtitle">(5) 탱크 온도</div>
                                    </div>
                                    {Boolean(this.state.bubbleDRYER_E319PV) && drawTable}
                                </div>
                            </div>{' '}
                            {/* 게이지 차트 적용(THEEND)*/}
                            {/*이벤트 관련 함수 4번 버튼을 클릭 했을때 출력값 및 셋팅값 show*/}
                            <div
                                id="detailSensor"
                                className="detailSensorNm"
                                style={{
                                    display: 'none',
                                    border: '1px solid black',
                                    width: '203px',
                                    height: '121px',
                                }}
                            >
                                <div
                                    id="effectSensor"
                                    style={{ transition: '1s', transform: 'translateZ(80px)' }}
                                >
                                    <table>
                                        <tbody>
                                            <tr>
                                                <td
                                                    colSpan="7"
                                                    style={{
                                                        height: '37px',
                                                        background: 'yellow',
                                                        fontSize: '15px',
                                                    }}
                                                >
                                                    균질기(출력값,셋팅값)
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style={{ width: '100px' }}>1차 압력 출력값</td>
                                                <td style={{ width: '100px' }}>
                                                    {this.state['DRYER_E207PV_Value']}bar
                                                </td>
                                            </tr>

                                            <tr>
                                                <td>1차 압력 셋팅값</td>
                                                <td>{this.state['DRYER_E207CV_Value']}%</td>
                                            </tr>
                                            <tr>
                                                <td style={{ width: '100px' }}>2차 압력 출력값</td>
                                                <td style={{ width: '100px' }}>
                                                    {this.state['DRYER_E208PV_Value']}bar
                                                </td>
                                            </tr>
                                            <tr>
                                                <td>2차 압력 셋팅값</td>
                                                <td>{this.state['DRYER_E208CV_Value']}%</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            {/*이벤트 관련 함수 6번 버튼을 클릭 했을때 출력값 및 셋팅값 show**/}
                            <div
                                id="detailSensor1"
                                className="detailSensorNm"
                                style={{
                                    position: 'relative',
                                    perspective: '500px',
                                    display: 'none',
                                    border: '1px solid black',
                                    width: '188px',
                                    height: '87px',
                                    top: '478px',
                                    left: '1202px',
                                }}
                            >
                                <div
                                    id="effectSensor"
                                    style={{ transition: '1s', transform: 'translateZ(0px)' }}
                                >
                                    <table>
                                        <tbody>
                                            <tr>
                                                <td
                                                    colSpan="3"
                                                    style={{
                                                        height: '37px',
                                                        background: 'yellow',
                                                        fontSize: '15px',
                                                    }}
                                                >
                                                    균질기
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style={{ width: '100px' }}>원액공급압력</td>
                                                <td style={{ width: '100px' }}>
                                                    {this.state['DRYER_E210PV_Value']}bar
                                                </td>
                                            </tr>
                                            <tr>
                                                <td>살균 후 온도</td>
                                                <td>{this.state['DRYER_E106PV_Value']}℃</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </Animated>
                    </div>
                </div>
            </React.Fragment>
        );
    }
}

export default withStyles(styles)(Video3);
