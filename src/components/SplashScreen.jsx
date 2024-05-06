import { Component } from 'react';

class SplashScreen extends Component {
  constructor(props) {
    super(props);
    this.state = { visible: true };
  }
  
  /** 2秒後に非表示 */
  componentDidMount() {
    this.timer = setTimeout(() => {
      this.setState({ visible: false });
    }, 2000);
  }
  
  /** タイマーをクリア */
  componentWillUnmount() {
    clearTimeout(this.timer);
  }

  /** 画面に表示 */
  render() {
    if (!this.state.visible) {
      return null;
    }

    return (
      <div style={{ 
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: 'lightblue'
      }}>
        <h1>Loading...</h1>
      </div>
    );
  }
}

export default SplashScreen;
