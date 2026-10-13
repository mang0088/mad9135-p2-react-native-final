import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  Dimensions,
  TextInput,
  TouchableHighlight,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';

import { fetchRestaurants, DEFAULT_RADIUS_M } from '../services/restaurantApi';

// No radius control existed previously, so a sensible default is used.
const RADIUS_METRES = DEFAULT_RADIUS_M;

function formatDistance(metres) {
  if (typeof metres !== 'number' || !Number.isFinite(metres)) return null;
  if (metres < 1000) return `${metres} m away`;
  return `${(metres / 1000).toFixed(1)} km away`;
}

function formatCategories(categories) {
  if (!Array.isArray(categories) || categories.length === 0) return null;

  const labels = categories
    .map((category) => String(category).split('.').slice(2).join(' '))
    .filter((label) => label !== '')
    .map((label) => label.replace(/_/g, ' '))
    .map((label) => label.charAt(0).toUpperCase() + label.slice(1));

  const unique = [...new Set(labels)];
  return unique.length > 0 ? unique.slice(0, 3).join(', ') : null;
}

export default function HomeScreen() {
  const [location, setLocation] = useState('');
  const [restaurants, setRestaurants] = useState([]);
  const [origin, setOrigin] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [ambiguous, setAmbiguous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  // Discards stale responses and prevents state updates after unmount.
  const requestIdRef = useRef(0);
  const abortRef = useRef(null);

  const runSearch = useCallback(async (params) => {
    const requestId = ++requestIdRef.current;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const result = await fetchRestaurants({
        ...params,
        radius: RADIUS_METRES,
        signal: controller.signal,
      });

      if (requestId !== requestIdRef.current) return;

      setRestaurants(result.restaurants);
      setOrigin(result.origin);
      setCandidates(result.candidates);
      setAmbiguous(result.ambiguous);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      if (err && err.code === 'ABORTED') return;

      setRestaurants([]);
      setCandidates([]);
      setAmbiguous(false);
      setOrigin(null);
      setError(err && err.message ? err.message : 'Something went wrong. Please try again.');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(
    () => () => {
      requestIdRef.current += 1;
      if (abortRef.current) abortRef.current.abort();
    },
    []
  );

  const onSubmit = () => {
    if (loading) return; // prevent duplicate submissions

    const text = location.trim();
    if (text === '') {
      setError('Enter a place name or postcode (for example Norwich or NR30 1AB).');
      setSearched(false);
      setRestaurants([]);
      setOrigin(null);
      setCandidates([]);
      setAmbiguous(false);
      return;
    }

    runSearch({ location: text });
  };

  const onSelectCandidate = (candidate) => {
    if (loading) return;
    setLocation(candidate.label || location);
    runSearch({
      lat: candidate.lat,
      lon: candidate.lon,
      locationLabel: candidate.label || undefined,
    });
  };

  const renderResults = () => {
    if (loading) {
      return (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text style={styles.stateText}>Searching for restaurants…</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.stateContainer}>
          <Text style={styles.stateText}>{error}</Text>
          <TouchableHighlight
            activeOpacity={0.9}
            style={styles.button}
            underlayColor="#D63113"
            onPress={onSubmit}
          >
            <Text style={styles.buttonText}>Retry</Text>
          </TouchableHighlight>
        </View>
      );
    }

    if (!searched) {
      return (
        <View style={styles.stateContainer}>
          <Text style={styles.stateText}>
            Enter a place name, town, city or postcode and tap Submit.
          </Text>
        </View>
      );
    }

    if (restaurants.length === 0) {
      return (
        <View style={styles.stateContainer}>
          <Text style={styles.stateText}>
            No restaurants found nearby. Try a wider area or a different postcode.
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={restaurants}
        renderItem={({ item }) => {
          const category = formatCategories(item.categories);
          const distance = formatDistance(item.distance);

          return (
            <View style={styles.cardContainer}>
              {/* The places data source supplies no photos, so the bundled
                  placeholder is used rather than a fabricated image. */}
              <Image
                style={styles.imageStyle}
                source={require('../assets/placeholder.png')}
              />
              <View style={styles.infoStyle}>
                <Text style={styles.titleStyle}>{item.name}</Text>
                <View style={styles.lineStyle} />
                <Text style={styles.categoryStyle}>
                  <Text style={{ fontWeight: '500' }}>Address </Text> {item.address}
                </Text>
                {distance ? (
                  <Text style={styles.categoryStyle}>
                    <Text style={{ fontWeight: '500' }}>Distance </Text> {distance}
                  </Text>
                ) : null}
                {category ? (
                  <Text style={styles.categoryStyle}>
                    <Text style={{ fontWeight: '500' }}>Category </Text> {category}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        }}
        keyExtractor={(item, index) =>
          String(item.placeId || `${item.lat},${item.lon}` || index)
        }
      />
    );
  };

  return (
    <View>
      <View style={styles.inputContainer}>
        <TextInput
          style={{
            height: 40,
            alignSelf: 'center',
            width: '60%',
            borderColor: 'gray',
            borderWidth: 1,
            padding: 10,
            borderRadius: 15,
            fontSize: 18,
            marginTop: 20,
            marginBottom: 10,
          }}
          placeholder="City, town or postcode"
          value={location}
          onChangeText={(text) => setLocation(text)}
          onSubmitEditing={onSubmit}
          returnKeyType="search"
          autoCorrect={false}
          editable={!loading}
        />
        <TouchableHighlight
          activeOpacity={0.9}
          style={styles.button}
          underlayColor="#D63113"
          onPress={onSubmit}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Submit</Text>
        </TouchableHighlight>
      </View>

      {origin && origin.label ? (
        <Text style={styles.originText} numberOfLines={2}>
          Showing restaurants near {origin.label}
        </Text>
      ) : null}

      {ambiguous && candidates.length > 1 ? (
        <View style={styles.candidateContainer}>
          <Text style={styles.candidateHint}>Not the right place? Pick another match:</Text>
          <View style={styles.candidateRow}>
            {candidates.slice(0, 5).map((candidate) => (
              <TouchableOpacity
                key={candidate.placeId || `${candidate.lat},${candidate.lon}`}
                style={styles.candidateChip}
                onPress={() => onSelectCandidate(candidate)}
                disabled={loading}
              >
                <Text style={styles.candidateText} numberOfLines={1}>
                  {candidate.label || `${candidate.lat}, ${candidate.lon}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.container}>{renderResults()}</View>
    </View>
  );
}

const deviceWidth = Math.round(Dimensions.get('window').width);
const offset = 40;
const radius = 20;
const styles = StyleSheet.create({
  container: {
    width: deviceWidth - 20,
    alignItems: 'center',
    marginTop: 25,
    paddingLeft: 15,
  },
  stateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 10,
  },
  stateText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
  originText: {
    marginTop: 10,
    marginHorizontal: 20,
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  candidateContainer: {
    marginTop: 10,
    paddingHorizontal: 15,
  },
  candidateHint: {
    fontSize: 14,
    marginBottom: 6,
  },
  candidateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  candidateChip: {
    backgroundColor: '#e6e6e6',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
    maxWidth: deviceWidth - 60,
  },
  candidateText: {
    fontSize: 13,
  },
  cardContainer: {
    width: deviceWidth - offset,
    backgroundColor: '#2596be',
    height: 360,
    marginBottom: 20,
    borderRadius: radius,

    shadowColor: '#000',
    shadowOffset: {
      width: 5,
      height: 5,
    },
    shadowOpacity: 0.75,
    shadowRadius: 5,
    elevation: 9,
  },
  imageStyle: {
    height: 200,
    width: deviceWidth - offset,
    borderTopLeftRadius: radius,
    borderTopRightRadius: radius,
    opacity: 0.9,
    alignContent: 'center',
    alignSelf: 'center',
  },
  lineStyle: {
    borderWidth: 0.5,
    borderColor: 'black',
    margin: 10,
  },
  titleStyle: {
    textAlign: 'center',
    fontFamily: 'Cochin',
    fontSize: 24,
    fontWeight: '800',
  },
  categoryStyle: {
    fontFamily: 'Gill Sans',
    fontSize: 18,
    fontWeight: '300',
    textAlign: 'center',
  },
  infoStyle: {
    marginHorizontal: 10,
    marginVertical: 5,
  },
  button: {
    alignItems: 'center',
    tintColor: 'white',
    backgroundColor: '#1071a4',
    padding: 10,
    marginLeft: 10,
    marginRight: 10,
    marginBottom: 10,
  },
  buttonText: {
    color: 'white',
    marginLeft: 10,
    fontSize: 18,
  },
  inputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  modalBackGround: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 30,
    borderRadius: 20,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    width: '100%',
    height: 60,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 20,
  },
});
