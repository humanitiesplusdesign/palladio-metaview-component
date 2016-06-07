/* global angular */
/* global d3 */
angular.module('palladioMetaview', ['palladio', 'palladio.services'])
	.run(['componentService', function(componentService) {
		var compileStringFunction = function (newScope, options) {
			var compileString = '<div data-palladio-metaview></div>';
			return compileString;
		};

		componentService.register('metaview', compileStringFunction);
	}])
	.directive('palladioMetaview', function (palladioService, dataService, parseService, $document) {
		return {
			scope : true,
			templateUrl : 'partials/palladio-metaview-component/template.html',
			link : {
				pre : function(scope, element) {
					scope.fileForArrowIndexChange = null;
					
					scope.clearArrowEffect = function() {
						scope.fileForArrowIndexChange = null;
					}
				},

				post : function(scope, element, attrs) {
					scope.metadata = dataService.getMetadata();
					scope.files = dataService.getFiles();
					scope.links = dataService.getLinks();
					scope.maxRecords = d3.max(scope.files, function(d) { return d.data.length; });

					scope.files.forEach(function(d) {
						d.fields.forEach(function(f) {
							// Re-parse uniques...
							var md = parseService.parseColumn(f.key,
								d.data, f.mvDelimiter,
								f.hierDelimiter, [], f.type);
							f.uniques = md.uniques;
							f.uniqueValues = f.uniques.map(function(u) { return u.key; });
							
							if(f.uniqueKey && f.type === "number") {
								f.type = 'uniqueNumeric';
							}
							if(f.uniqueKey && f.type === "text") {
								f.type = 'uniqueText';
							}
							if(f.uniques.length === 2) {
								f.type = 'binary0';
							}
							if(f.uniques.length > 2 && f.uniques.length < 10 && f.type === 'number') {
								f.type = 'ordinalNumeric';
							}
							if(f.uniques.length > 2 && f.uniques.length < 10 && f.type === 'text') {
								f.type = 'nominalText';
							}
						});
					});
					
					scope.sortFields = function(file) {
						file.fields.forEach(function(f) { scope.sortField(f, file); });
					}
					
					scope.sortField = function(field, file) {
						switch(file.sortMode) {
							case 'Map errors and gaps':
								field.sortedValues = file.data.map(function(d) {
									return d[field.key];
								}).map(function(d) {
									return {
										value: d,
										color: scope.colorCalc(d, 'error', field)
									};
								});
								break;
							case 'Map by data types':
								field.sortedValues = file.data.map(function(d) {
									return d[field.key];
								}).map(function(d) {
									return {
										value: d,
										color: scope.colorCalc(d, 'type', field)
									};
								});
								break;
							case 'Sort by values':
								field.sortedValues = file.data.map(function(d) {
									return d[field.key];
								}).map(function(d) {
									return {
										value: d,
										color: scope.colorCalc(d, 'type', field)
									};
								}).sort(function(a,b) { return a.color < b.color ? -1 : 1; });
								break;
						}
					}

					scope.colors = {
						uniqueNumeric: '#E0CD29',
						uniqueText: '#E07129',
						numeric: '#BBAA1B',
						number: '#BBAA1B',
						text: '#BB5A1B',
						binary0: '#9988C0',
						binary1: '#CD88BD',
						ordinalNumeric: '#767A79',
						nominalText: '#53585F',
						coordinates: '#A1C088',
						latlong: '#A1C088',
						date: '#577AA4',
						YYYYMMDD: '#577AA4',
						YYYYMM: '#88A1C0',
						YYYY: '#A9BBD2',
						url: '#C0A788',
						'null': '#FFFFFF',
						mismatch: '#EC5D57'
					};

					scope.textColors = {
						uniqueNumeric: '#FFFFFF',
						uniqueText: '#FFFFFF',
						numeric: '#FFFFFF',
						number: '#FFFFFF',
						text: '#FFFFFF',
						binary0: '#FFFFFF',
						binary1: '#FFFFFF',
						ordinalNumeric: '#FFFFFF',
						nominalText: '#FFFFFF',
						coordinates: '#FFFFFF',
						latlong: '#FFFFFF',
						date: '#FFFFFF',
						YYYYMMDD: '#FFFFFF',
						YYYYMM: '#FFFFFF',
						YYYY: '#FFFFFF',
						url: '#FFFFFF',
						'null': '#444444',
						mismatch: '#FFFFFF'
					};
					
					scope.typeTexts = {
						uniqueNumeric: 'Unique Numeric',
						uniqueText: 'Unique Text',
						numeric: 'Numeric',
						number: 'Numeric',
						text: 'Text',
						binary0: 'Binary',
						binary1: 'Binary',
						ordinalNumeric: 'Ordinal Numeric (<10 values)',
						nominalText: 'Nominal Text (<10 values)',
						coordinates: 'Coordinates',
						latlong: 'Coordinates',
						date: 'Date',
						YYYYMMDD: 'Date (YYYY-MM-DD)',
						YYYYMM: 'Date (YYYY-MM)',
						YYYY: 'Date (YYYY)',
						url: 'URL',
						'null': 'not defined',
						mismatch: 'match error'
					}
					
					// Set up tooltips
					setTimeout(function() {
						angular.element(element[0]).find('div.dimension-type').tooltip();
					}, 100);
					
					scope.centerTable = function(ev) {
						// Do this async so that page can re-render first and table container can expand.
						function internalUpdate() {
							var tableNode = ev.currentTarget.parentNode.parentNode.parentNode;
							tableNode.parentNode.scrollLeft = tableNode.parentNode.scrollLeft - 30 + tableNode.getBoundingClientRect().left;
						}
						setTimeout(internalUpdate);
					};

					scope.calcPosition = function(file) {
						if($('.table-display')[0].getBoundingClientRect().left < 0) {
							
							return 'absolute';
						}
						return 'relative';
					};
					
					scope.calcTop = function(tada) {
						return $('body')[0].getBoundingClientRect().top;
					}

					$('#tables').scroll(function() { scope.$digest(); });

					scope.colorCalc = function(value, calcType, field) {
						if(calcType === 'error') {
							if(value === null || value === undefined || value === "") return scope.colors['null'];
							if(sniff(value) !== field.type &&
								!(sniff(value) === 'number' && (field.type === 'uniqueNumeric' || field.type === 'ordinalNumeric' )) &&
								!(sniff(value) === 'text' && (field.type === 'uniqueText' || field.type === 'nominalText')) &&
								!(sniff(value) === 'text' && field.type === 'uniqueText') &&
								!((value.length === 4 || value.length === 7) && field.type === 'date') &&
								field.type !== 'binary0' ) {

								return scope.colors.mismatch;
							}
							return '#bbbbbb';
						}
						if(calcType === 'edit') {
							if(sniff(value) !== field.type &&
								!(sniff(value) === 'number' && (field.type === 'uniqueNumeric' || field.type === 'ordinalNumeric' )) &&
								!(sniff(value) === 'text' && (field.type === 'uniqueText' || field.type === 'nominalText')) &&
								!(sniff(value) === 'text' && field.type === 'uniqueText') &&
								field.type !== 'binary0' ) {

								return scope.colors.mismatch;
							}
							return '#bbbbbb';
						}
						if(calcType === 'type') {
							if(field.type === 'ordinalNumeric' && sniff(value) === 'number') {
								return scope.colors['ordinalNumeric'];
							} else if (field.type === 'binary0' && field.uniqueValues && (value === field.uniqueValues[0] || value === field.uniqueValues[1])) {
								return value === field.uniqueValues[0] ? scope.colors['binary0'] : scope.colors['binary1'];
							} else if ( (field.type === 'ordinalNumeric' || field.type === 'nominalText') && value && field.uniqueValues.indexOf(value.split(field.mvDelimiter)[0]) !== -1) {
								return scope.colors[field.type];
							} else {
								return scope.colors[sniff(value)];	
							}
						}
					};
					
					scope.assignIndexAndFile = function(file, index) {
						 file.editIndex = index;
						 scope.fileForArrowIndexChange = file;
					}
					
					$document.keydown(function(ev) {
						scope.$apply(function(s) {
							if(ev.keyCode === 27) { s.files.forEach(function(f) { f.editIndex = null; }); }
							if(ev.keyCode === 37 && scope.fileForArrowIndexChange && scope.fileForArrowIndexChange.editIndex > 0) {
								ev.preventDefault();
								scope.fileForArrowIndexChange.editIndex--;
							}
							if(ev.keyCode === 39 && scope.fileForArrowIndexChange && scope.fileForArrowIndexChange.editIndex < scope.fileForArrowIndexChange.data.length-1) {
								ev.preventDefault();
								scope.fileForArrowIndexChange.editIndex++;
							}
						})
					});

					scope.numberWithValue = function(file, field) {
						return file.data.filter(function(d) { return d[field.key] !== null && d[field.key] !== undefined && d[field.key] !== ""; }).length;
					};

					var isBoolean = function(value) {
						return typeof value == 'boolean';
					};

					var isString = function(value){
						return typeof value == 'string';
					};

					var isArray = function(value){
						return value.toString() == '[object Array]';
					};

					var isNumber = function(value){
						return typeof value == 'number' || RegExp('^\\d*$').test(value);
					};

					var isObject = function(value){
						return value !== null && typeof value == 'object';
					};

					var isDate = function(value){
						return value.toString() == '[object Date]';
					};

					var isFunction = function(value){
						return typeof value == 'function';
					};

					var isBooleanLike = function(value){
						if (value.toLowerCase() === 'true' || value.toLowerCase() === 'yes' || value === 1 ) return true;
						if (value.toLowerCase() === 'false' || value.toLowerCase() === 'no' || value === 0 ) return true;
						return false;
					};

					var isNumberLike = function(value) {
						return !isNaN(value.replace(',','.'));
					};

					var isDateLike = function(value){
						// We allow zero-dates (1999-00-00) even though they aren't technically valid.
						// We allow negative years in dates
						var dateTest = RegExp('^[-]\\d\\d\\d\\d($)|([-](0[0-9]|1[012]|[0-9])[-](0[0-9]|[12][0-9]|3[01]|[0-9])$)');
						if(dateTest.test(value)) return true;
						return false;
					};

					var isLatLonLike = function(value){
						var pieces = value.split(',');
						if (pieces.length !== 2) return false;
						if (isNumberLike(pieces[0]) && isNumberLike(pieces[1])) return true;
						return false;
					};

					var isUrlLike = function(value){
						if ( value.indexOf("https://") === 0 || value.indexOf("http://") === 0 || value.indexOf("www.") === 0 ) return true;
						return false;
					};

					var sniff = function(value) {
						if (typeof value === 'undefined' || value === null || value.length === 0) return 'null';
						if (isObject(value)) return 'object';
						if (isArray(value)) return 'array';
						if (isNumber(value) && value.length === 4) { return 'YYYY'; }
						if (isNumber(value)) return 'number';
						// String
						if (isUrlLike(value)) return 'url';
						//if (isBooleanLike(value)) return 'boolean';
						if (isDateLike(value) && value.length === 4) return 'YYYY';
						if (isDateLike(value) && value.length === 7) return 'YYYYMM';
						// if (isDateLike(value) && value.length === 10) return 'YYYYMMDD';
						if (isDateLike(value)) return 'date';
						if (isNumberLike(value)) return 'number';
						if (isLatLonLike(value)) return 'latlong';
						if (isString(value)) return 'text';
						return null;
					};
				}
			}
		};
	});

angular.module('palladio').run(['$templateCache', function($templateCache) {
    $templateCache.put('partials/palladio-metaview-component/template.html',
        "<div id=\"main\">\n\t<div id=\"table-histograms\" class=\"center-block container-fluid\">\n\t\t<div class=\"table-histogram row\" ng-repeat=\"file in files\">\n\t\t\t<div class=\"col-md-2\">\n\t\t\t\t<span class=\"pull-right\">{{file.label}}</span>\n\t\t\t</div>\n\t\t\t<div class=\"col-md-8\">\n\t\t\t\t<div \n\t\t\t\t\tstyle=\"width: {{85 * file.data.length / maxRecords}}%; background-color: #D3D3D3; height: 10px; margin-top: 5px; display: inline-block\">\n\t\t\t\t</div>\n\t\t\t\t<span style=\"font-weight: lighter; font-size: smaller\">{{file.data.length}} records</span>\n\t\t\t</div>\n\t\t</div>\n\t</div>\n\t<div class=\"clearfix\" style=\"height:50px\"></div>\n\t<div id=\"tables\" \n\t\t\tstyle=\"margin-bottom: 2px; height: 100%; padding-left: 30px;\">\n\t\t<div class=\"table-display\" ng-repeat=\"file in files\"\n\t\t\tstyle=\"vertical-align:top; margin-right: 30px;\"\n\t\t\tng-init=\"sortModes=['Map errors and gaps','Map by data types','Sort by values']; file.sortMode = sortModes[0]; sortFields(file); file.displayType = true;\">\n\t\t\t<div class=\"table-header pull-left\" style=\"margin-bottom: 7px; overflow:hidden; white-space: nowrap; display: inline-block; clear: both;\">\n\t\t\t\t<span class=\"labels\" style=\"width:263px; display:inline-block\">\n\t\t\t\t\t<span class=\"table-label\" style=\"font-weight: strong; font-size: larger\">{{file.label}}</span>\n\t\t\t\t</span>\n\t\t\t\t<span style=\"width: 35px; padding: 5px; display: inline-block;\">\n\t\t\t\t\t<!--<input type=\"checkbox\" \n\t\t\t\t\t\tng-model=\"file.displayType\"\n\t\t\t\t\t\tstyle=\"height: 16px; width: 16px;\">\n\t\t\t\t\t</input>-->\n\t\t\t\t</span>\n\t\t\t\t<span>\n\t\t\t\t\t<span ng-repeat=\"mode in sortModes\" style=\"margin-left: 10px; margin-right: 10px\"\n\t\t\t\t\t\tng-style=\"{ 'color': mode === file.sortMode ? '#bbbbbb' : '#68ABE5' }\"\n\t\t\t\t\t\tng-click=\"file.sortMode = mode; file.sortMode === sortModes[2] ? file.editIndex = null : null; sortFields(file);\">\n\t\t\t\t\t\t{{mode}}\n\t\t\t\t\t</span>\n\t\t\t\t</span>\n\t\t\t</div>\n\t\t\t<div class=\"dimension pull-left\" ng-repeat=\"field in file.fields\"\n\t\t\t\tstyle=\"overflow:hidden; white-space: nowrap; margin-bottom: 2px; height: 35px; display: inline-block; clear: both; left: -30px;\">\n\t\t\t\t<div style=\"height: 35px; width: 300px; display: inline-block; left: 0px;\">\n\t\t\t\t\t<div class=\"dimension-main\" style=\"height: 35px; width: 263px; background-color: #eeeeee; padding: 5px; font-weight: lighter; display: inline-block;\">\n\t\t\t\t\t\t<div style=\"left: 5px; background-color: #eeeeee; padding-left: 5px; padding-right: 5px; border-radius: 4px\"\n\t\t\t\t\t\t\tng-style=\"{ position: calcPosition(file) }\">\n\t\t\t\t\t\t\t<span class=\"pull-left\" style=\"margin-top: 3px\">{{field.description}}{{field.mvDelimiter ? ' (M)' : ''}}</span>\n\t\t\t\t\t\t</div>\n\t\t\t\t\t\t<!--<span class=\"dimension-specials pull-right\">\n\t\t\t\t\t\t\t<div class=\"special-character\" ng-repeat=\"special in field.special\"\n\t\t\t\t\t\t\t\tstyle=\"height: 25px; width: 25px; display: inline-block; margin-right: 2px; text-align: center; font-size: larger; font-weight: strong; border-radius: 4px;\"\n\t\t\t\t\t\t\t\tng-style=\"{ 'background-color': field.unassignedSpecialChars.indexOf(special) !== -1 ? '#bbbbbb' : '#EC5D57' }\">\n\t\t\t\t\t\t\t\t{{special}}\n\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t</span>-->\n\t\t\t\t\t</div>\n\t\t\t\t\t<div style=\"width: 35px; height:35px; display: inline-block; margin-left: -2px; padding: 5px\";\n\t\t\t\t\t\tng-style=\"{ 'background-color' : file.displayType ? colors[field.type] : '#eeeeee' }\"\n\t\t\t\t\t\tdata-toggle=\"tooltip\" data-placement=\"top\" title=\"{{typeTexts[field.type] ? typeTexts[field.type] : 'not found'}}\"\n\t\t\t\t\t\tclass=\"dimension-type\">\n\t\t\t\t\t\t<span class=\"pull-left\"\n\t\t\t\t\t\t\tstyle=\"width: 25px; font-weight: lighter; margin-top: 3px; text-align: center;\"\n\t\t\t\t\t\t\tng-style=\"{ color: file.displayType ? textColors[field.type] : '#444444' }\">\n\t\t\t\t\t\t\t{{numberWithValue(file, field)}}\n\t\t\t\t\t\t</span>\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t\t<div style=\"height: 35px; display: inline-block; margin-left: -2px\">\n\t\t\t\t\t<span ng-show=\"file.editIndex !== null && file.editIndex !== undefined\"\n\t\t\t\t\t\tstyle=\"height: 35px; display: inline-block; width: 200px; position: relative; float: left;\"\n\t\t\t\t\t\tng-style=\"{ left: file.editIndex*4 }\">\n\t\t\t\t\t\t<input type=\"text\" ng-model=\"file.data[file.editIndex][field.key]\"\n\t\t\t\t\t\t\tdisabled\n\t\t\t\t\t\t\tstyle=\"width:200px; margin:0px; height: 35px;\"\n\t\t\t\t\t\t\tng-focus=\"clearArrowEffect()\"\n\t\t\t\t\t\t\tng-change=\"field.sortedValues[file.editIndex].color = colorCalc(file.data[file.editIndex][field.key], file.sortMode === sortModes[0] ? 'edit' : 'type', field)\"></input>\n\t\t\t\t\t</span>\n\t\t\t\t\t<div style=\"height:35px; display: inline-block\"\n\t\t\t\t\t\tng-style=\"{ 'margin-left': file.editIndex !== null && file.editIndex !== undefined ? '-200px' : '0px' }\">\n\t\t\t\t\t\t<div ng-repeat=\"obj in field.sortedValues\"\n\t\t\t\t\t\t\tstyle=\"height: 35px; margin-right: 1px; display: inline-block;\"\n\t\t\t\t\t\t\tng-style=\"{ width: $index === file.editIndex ? '200px' : 3 + 'px', 'background-color': $index === file.editIndex ? 'white' : obj.color }\"\n\t\t\t\t\t\t\tng-click=\"file.sortMode !== sortModes[2] ? assignIndexAndFile(file, $index) : null\">\n\t\t\t\t\t\t</div>\n\t\t\t\t\t\t<div style=\"height: 35px; margin-right: 1px; width:200px; display: inline-block;\"></div>\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t\t<div class=\"pull-left\" style=\"height: 30px; width: 100%;\"></div>\n\t\t</div>\n\t<div>\n</div>");
}]);