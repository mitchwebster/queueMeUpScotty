import React, { Component } from 'react'; // let's also import Component
import axios from 'axios';
import Card from '@material-ui/core/Card';
import CardActions from '@material-ui/core/CardActions';
import CardContent from '@material-ui/core/CardContent';
import CardMedia from '@material-ui/core/CardMedia';
import Slider from '@material-ui/core/Slider';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import { withStyles, StyledComponentProps, WithStyles, createStyles } from '@material-ui/core/styles'

const updateIntervalMs = 500;
const styles = () => createStyles({
  root: {
    maxWidth: 800,
  },
  media: {
    height: 800,
  },
});

interface ComponentProps {}

type PlayerState = {
  is_playing: boolean
  progressMs: number
  durationMs: number
  songCompletePercent: number
  songName: string
  albumImageUrl: string
  albumName: string
  artists: string[]
};

class App extends Component<ComponentProps & WithStyles<typeof styles>, PlayerState> {
  updatePlayer() {
    // this is the player default state
    var initialState = {
      is_playing: false,
      progressMs: 0,
      durationMs: 2 * 60 * 1000, // This will cause us to check after every 2 minutes
      songCompletePercent: 0,
      songName: '',
      albumImageUrl: '',
      albumName: '',
      artists: [''],
    };

    if (this.state === null)
    {
      this.setState(initialState); // just to ensure we dont spam the api if it fails
      axios.get(`/api/Player`)
      .then(res => {
        console.log(res.data);
        if (res.data.is_playing) {
          initialState.is_playing = true;
          initialState.progressMs = res.data.progress_ms;
          initialState.durationMs = res.data.duration_ms;
          initialState.songCompletePercent = 100*(res.data.progress_ms / res.data.duration_ms);
          initialState.songName = res.data.name;
          initialState.albumImageUrl = res.data.album.images[0].url;
          initialState.albumName = res.data.album.name;
          initialState.artists = res.data.artists;
        }
      });

      this.setState(initialState);
      return;
    }

    var progressMsCopy = this.state.progressMs;
    if (progressMsCopy + updateIntervalMs < this.state.durationMs)
    {
      progressMsCopy += updateIntervalMs;
      var songCompletePercent = progressMsCopy / this.state.durationMs;
      this.setState(prevState => ({
        ...this.state,
        progressMs: progressMsCopy,
        songCompletePercent: 100*songCompletePercent
      }));
      return;
    }

    // Otherwise we have just finished a song/polling period - make the call again
    axios.get(`/api/Player`)
      .then(res => {
        console.log(res.data);
        if (res.data.is_playing) {
          initialState.is_playing = true;
          initialState.progressMs = res.data.progress_ms;
          initialState.durationMs = res.data.duration_ms;
          initialState.songCompletePercent = 100*(res.data.progress_ms / res.data.duration_ms);
          initialState.songName = res.data.name;
          initialState.albumImageUrl = res.data.album.images[0].url;
          initialState.albumName = res.data.album.name;
          initialState.artists = res.data.artists;
        }
      });

    this.setState(initialState);
  };

  // Before the component mounts, we initialise our state
  componentWillMount() {
    this.updatePlayer();
  };

  componentDidMount() {
    setInterval(() => this.updatePlayer(), updateIntervalMs);
  }

  render() {
    if (!this.state.is_playing)
    {
      return <Card className={this.props.classes.root}>
      <CardContent>
        <Typography gutterBottom variant="h5" component="h2">
          Nothing is playing currently.
        </Typography>
      </CardContent>
    </Card>;
    }

    return <Card className={this.props.classes.root}>
      <CardMedia
        component="img"
        className={this.props.classes.media}
        image={this.state.albumImageUrl}
        title={this.state.albumName}
        height="640"
      />
      <CardContent>
        <Typography gutterBottom variant="h5" component="h2">
          {this.state.songName}
        </Typography>
        <Typography variant="body2" color="textSecondary" component="p">
          {this.state.albumName} - {this.state.artists}
        </Typography>
      </CardContent>
      <Slider disabled value={this.state.songCompletePercent} aria-labelledby="disabled-slider" />
      <CardActions>
        <Button size="small" color="primary">
          Find on Spotify
        </Button>
      </CardActions>
    </Card>;
  };
}

export default withStyles(styles)(App);