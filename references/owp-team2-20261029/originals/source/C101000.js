import { Icon, Typography } from '@material-ui/core';
import history from 'history.js';
import React, { Component } from 'react';
import Video0 from './video0';
import Video1 from './video1';
import Video2 from './video2';
import Video3 from './video3';
import Video34 from './video34';
import Video57 from './video57';
import RadioGroup from '@material-ui/core/RadioGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Radio from '@material-ui/core/Radio';
import { Animated } from 'react-animated-css';
import { OwpButton } from '@wrapper';
import Dialog from 'main/content/include/Dialog_ccpSearch'; // 종료

class Page extends Component {
    componentDidMount() {
        const innerWidth = window.innerWidth;
        this.setState({ innerWidth: innerWidth });
        this.setState({ zoomRatio: (innerWidth / 1920) * 100 });
    }

    constructor(props) {
        super(props);
        this.state = {
            visible: true,
            checked0: true,
            checked1: false,
            checked2: false,
            checked3: false,
            checked34: false,
            checked57: false,
        };
    }

    ___handleChange = (event) => {
        this.setState({ [event.target.name]: event.target.checked });
    };
    handleChange = (event, val) => {
        // console.log("handleChange v", val)

        this.state = {
            checked0: false,
            checked1: false,
            checked2: false,
            checked3: false,
            checked34: false,
            checked57: false,
        };

        this.setState(
            {
                checked0: false,
                checked1: false,
                checked2: false,
                checked3: false,
                checked34: false,
                checked57: false,
            },
            () => {
                this.playScene(val);
            }
        );
    };

    playScene = (val) => {
        this.setState({ ['checked' + val]: true });
    };

    render() {
        return (
            <React.Fragment>
                <div style={{ position: 'relative', width: `${this.state.innerWidth}px` }}>
                    <div
                        className="p-20 bg_black_theme01 w100 bg_btp"
                        style={{ position: 'absolute', zIndex: '2' }}
                    >
                        <div className="row justify-between">
                            <div className="col-lg-6 col-xs-12 col-sm-12">
                                <div className="flex flex-shrink items-center">
                                    <Icon className="text-32 mr-12 c04">blur_on</Icon>
                                    <Typography
                                        variant="h6"
                                        className="hidden sm:flex text-nowrap c06"
                                    >
                                        실시간 공정 현황
                                    </Typography>

                                    <RadioGroup
                                        aria-label="position"
                                        name="position"
                                        value={this.state.value}
                                        onChange={this.handleChange}
                                        row
                                        defaultValue="0"
                                        className="ml-24 mt-6"
                                    >
                                        <FormControlLabel
                                            value="0"
                                            control={
                                                <Radio
                                                    color="secondary"
                                                    checked={this.state.checked0}
                                                />
                                            }
                                            label="Intro"
                                            labelPlacement="end"
                                        />
                                        <FormControlLabel
                                            value="1"
                                            control={
                                                <Radio
                                                    color="secondary"
                                                    checked={this.state.checked1}
                                                />
                                            }
                                            label="2팀"
                                            labelPlacement="end"
                                        />
                                        <FormControlLabel
                                            value="2"
                                            control={
                                                <Radio
                                                    color="secondary"
                                                    checked={this.state.checked2}
                                                />
                                            }
                                            label="2팀 1층"
                                            labelPlacement="end"
                                        />
                                        <FormControlLabel
                                            value="3"
                                            control={
                                                <Radio
                                                    color="secondary"
                                                    checked={this.state.checked3}
                                                />
                                            }
                                            label="2팀 3층"
                                            labelPlacement="end"
                                        />
                                        <FormControlLabel
                                            value="34"
                                            control={
                                                <Radio
                                                    color="secondary"
                                                    checked={this.state.checked34}
                                                />
                                            }
                                            label="2팀 4층"
                                            labelPlacement="end"
                                        />
                                        <FormControlLabel
                                            value="57"
                                            control={
                                                <Radio
                                                    color="secondary"
                                                    checked={this.state.checked57}
                                                />
                                            }
                                            label="2팀 5~7층"
                                            labelPlacement="end"
                                        />
                                    </RadioGroup>
                                    <div className={'hidden'}>
                                        <OwpButton
                                            variant="contained"
                                            onClick={() => this.Dialog.openDialog('D003002', '')}
                                        >
                                            CCP/선행요건 조회
                                        </OwpButton>
                                        <Dialog
                                            callback={null}
                                            onRef={(ref) => (this.Dialog = ref)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="col-lg-6 col-xs-12 col-sm-12">
                                <div className="row">
                                    <div className="col-lg-12 col-xs-12 col-sm-12">
                                        <div className="flex items-center b ft16 f_r">
                                            <button>
                                                <img
                                                    alt="OWP"
                                                    src="assets/images/logos/hcg.png"
                                                    style={{
                                                        height: '100px',
                                                        marginTop: '-30px',
                                                        marginBottom: '-37px',
                                                    }}
                                                    onClick={() => {
                                                        history.push({
                                                            pathname: '/',
                                                        });
                                                    }}
                                                />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Animated
                        animationIn="jackInTheBox"
                        animationOut="fadeOut"
                        animationInDuration={1500}
                        animationOutDuration={0}
                        animateOnMount={false}
                        isVisible={this.state.checked0}
                    >
                        <div
                            style={{ width: '100%' }}
                            className={this.state.checked0 ? 'fadeIn' : 'fadeOut'}
                        >
                            {' '}
                            {/**/}
                            <Video0
                                play={this.state.checked0}
                                callFunction={(val) => {
                                    this.handleChange(null, val);
                                }}
                            />
                        </div>
                    </Animated>
                    <Animated
                        animationIn="jackInTheBox"
                        animationOut="fadeOut"
                        animationInDuration={1500}
                        animationOutDuration={0}
                        animateOnMount={false}
                        isVisible={this.state.checked1}
                    >
                        <div
                            style={{ width: '100%' }}
                            className={this.state.checked1 ? 'fadeIn' : 'fadeOut'}
                        >
                            <Video1 play={this.state.checked1} />
                        </div>
                    </Animated>
                    <Animated
                        animationIn="jackInTheBox"
                        animationOut="fadeOut"
                        animationInDuration={1500}
                        animationOutDuration={0}
                        animateOnMount={false}
                        isVisible={this.state.checked2}
                    >
                        <div
                            style={{ width: '100%' }}
                            className={this.state.checked2 ? 'fadeIn' : 'fadeOut'}
                        >
                            <Video2 play={this.state.checked2} />
                        </div>
                    </Animated>
                    <Animated
                        animationIn="jackInTheBox"
                        animationOut="fadeOut"
                        animationInDuration={1500}
                        animationOutDuration={0}
                        animateOnMount={false}
                        isVisible={this.state.checked3}
                    >
                        <div
                            style={{ width: '100%' }}
                            className={this.state.checked3 ? 'fadeIn' : 'fadeOut'}
                        >
                            <Video3 play={this.state.checked3} />
                        </div>
                    </Animated>
                    <Animated
                        animationIn="jackInTheBox"
                        animationOut="fadeOut"
                        animationInDuration={1500}
                        animationOutDuration={0}
                        animateOnMount={false}
                        isVisible={this.state.checked34}
                    >
                        <div
                            style={{ width: '100%' }}
                            className={this.state.checked34 ? 'fadeIn' : 'fadeOut'}
                        >
                            <Video34 play={this.state.checked34} />
                        </div>
                    </Animated>
                    <Animated
                        animationIn="jackInTheBox"
                        animationOut="fadeOut"
                        animationInDuration={1500}
                        animationOutDuration={0}
                        animateOnMount={false}
                        isVisible={this.state.checked57}
                    >
                        <div
                            style={{ width: '100%' }}
                            className={this.state.checked57 ? 'fadeIn' : 'fadeOut'}
                        >
                            <Video57 play={this.state.checked57} />
                        </div>
                    </Animated>
                </div>
            </React.Fragment>
        );
    }
}

export default Page;
