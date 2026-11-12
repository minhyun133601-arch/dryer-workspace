import {withStyles} from '@material-ui/core/styles';
import React from 'react';
import {BigPlayButton, ControlBar, Player} from 'video-react';
import './video.css';
import PropTypes from "prop-types";
import {Animated} from "react-animated-css";

/*
    Location    : 실시간 공정현황>3D 영상
    Deacriptin  : 영상화면1
    FileName    : video.js
    Author      : sy.oh
    Date        : 2020.04.09
    Work        : 영상 중 [ICA1~3, X-ray1~3] 공정 부분을 매핑함.
*/

const propTypes = {
    callFunction : PropTypes.func
};

const styles = theme => ({
    popover: {
        pointerEvents: 'none',
    },
    paper: {
        padding: theme.spacing.unit,
    },
});

const sources = {
    pellerar: '/assets/models/heechang_0516_intro.webm'
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
        return inputNumber.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    componentDidMount() {
        // subscribe state change
        this.player.subscribeToStateChange(this.handleStateChange.bind(this));

        const innerWidth = window.innerWidth;
        //console.log('innerWidth',innerWidth);
        this.setState({innerWidth: innerWidth});
        this.setState({zoomRatio: (innerWidth / 1920) * 100});

    }

    componentWillUnmount() {

    }

    showlabel = false ;
    paused = true;
    componentDidUpdate(prevProps, prevState, snapshot) {

        if(this.state.player){

            // console.log(this.state.player.currentTime);
            // console.log('this.showlabel',this.showlabel);
            // console.log('this.state.showlabel',this.state.showlabel);
            // console.log('this.props.play',this.props.play);
            // console.log('this.paused',this.paused);

            if (this.props.play===true && this.state.player.currentTime === 0) {
                this.play();
                this.paused = false;
                this.showlabel = false ;
            }

            if (this.props.play===false && this.state.player.currentTime > 0){
                //this.seek(0);
                this.player.seek(0);
                this.player.pause();
                console.log('this.player.pause()');
                this.paused = true;
                this.showlabel = false ;
            }

            if(this.showlabel===true && this.state.showlabel === false){
                this.setState({showlabel:true});
            }else if(this.showlabel===false && this.state.showlabel === true){
                this.setState({showlabel:false});
            }

            if (this.props.play===true && this.showlabel===false && this.state.player.currentTime > 3) {
                this.showlabel = true ;
                this.setState({showlabel:true});
            }

            if (this.showlabel ===true && this.state.showlabel === true && this.state.player.currentTime > 7.7) {
                this.player.seek(6);
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
            const {player} = this.player.getState();
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
                <div style={{position: 'relative', width: `${this.state.innerWidth}px`}}>
                    <Player
                        ref={player => {
                            this.player = player;
                        }}
                        // autoPlay
                        muted
                        // loop
                        LoadingSpinner={null}
                    >
                        <source src={this.state.source}/>
                        <ControlBar
                            disableDefaultControls={true}
                            autoHide={true}
                            autoHideTime={1}
                        />
                        <BigPlayButton position="center"/>
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
                        <Animated animationIn="fadeIn" animationOut="fadeOut"
                                  animationInDuration={1500} animationOutDuration={800}
                                  animateOnMount={false} isVisible={this.state.showlabel}
                        >
                            <div className="ZOOM ZL-01" style={{zIndex: "10"}} onClick={() => {
                                this.props.callFunction(1);
                            }}/>
                        </Animated>

                    </div>



                </div>



            </React.Fragment>
        );
    }
}

Video0.propTypes = propTypes;

export default withStyles(styles)(Video0);
