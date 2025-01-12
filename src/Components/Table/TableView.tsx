import React from 'react'

// Component imports
import TableContent from './TableContent'
import TableAttributeType from './enums/TableAttributeType'
import TableAttributesInfo from './DataStorageClasses/TableAttributesInfo'
import PrimaryTableAttribute from './DataStorageClasses/PrimaryTableAttribute'
import SecondaryTableAttribute from './DataStorageClasses/SecondaryTableAttribute'
import TableAttribute from './DataStorageClasses/TableAttribute'
import Restriction from './DataStorageClasses/Restriction'
import { Card } from 'antd'
import './TableView.css'

const NUMBER_OF_TUPLES_PER_PAGE_TIMEOUT: number = 500

enum CurrentView {
    TABLE_CONTENT
}

interface TableViewProps {
    token: string
    route: string
    tableName: string
    link?: string
    channel?: string
    databaseHost?: string
    updateRestrictionList: (queryParams: string) => string
    updatePageStore: (key: string, record: Array<string>) => void
}

interface TableViewState {
    tableAttributesInfo?: TableAttributesInfo // TableAttributesInfo object that stores all info on current table attirbutes
    currentView: CurrentView // Switcher between Content and Info view
    tableContentNeedRefresh: boolean // Boolean trigger if the tableContent needs to be refreshed
    numberOfTuplesPerPage: number // Number of tuples to view per page
    setNumberOFTuplesPerPageTimeout: ReturnType<typeof setTimeout> // Timeout for when to actaully apply the change in numberOfTuples per page
    totalNumOfTuples: number // Total number of tuples for the given table
    currentPageNumber: number // Current page number that is being rendered
    maxPageNumber: number // The max page number which is computed upon fetching the table tuples
    tableContentData: Array<any> // The tuples of the table stored in an array. Type any used here as there are many possible types with all the available input blocks
    errorMessage: string // Error message buffer
    isLoading: boolean // Boolean for loading animation
    restrictions: Array<Restriction> // Storage for the last requested restrction to deal with case such as numberOfTuplesPerPage change
    orders: Array<string> //Storage for the sorting, currently type any but could change to a custom type
}

/**
 * Parent component for handling displaying TableContent and TableInfo
 */
export default class TableView extends React.Component<TableViewProps, TableViewState> {
    constructor(props: TableViewProps) {
        super(props)
        this.state = {
            tableAttributesInfo: undefined,
            currentView: CurrentView.TABLE_CONTENT,
            tableContentNeedRefresh: true,
            numberOfTuplesPerPage: 25,
            setNumberOFTuplesPerPageTimeout: setTimeout(() => {}, 1000),
            currentPageNumber: 1,
            maxPageNumber: 1,
            tableContentData: [],
            totalNumOfTuples: 0,
            errorMessage: '',
            isLoading: false,
            restrictions: [],
            orders: []
        }

        this.fetchTableAttributeAndContent = this.fetchTableAttributeAndContent.bind(this)
        this.setPageNumber = this.setPageNumber.bind(this)
        this.setNumberOfTuplesPerPage = this.setNumberOfTuplesPerPage.bind(this)
        this.fetchTableAttribute = this.fetchTableAttribute.bind(this)
        this.fetchTableContent = this.fetchTableContent.bind(this)
        this.setRestrictions = this.setRestrictions.bind(this)
        this.setOrders = this.setOrders.bind(this)
        this.fetchTableAttributeAndContent()
    }

    /**
     * Setter method to change which page is being viewed
     * @param pageNumber Page number that the user wants to view
     */
    setPageNumber(pageNumber: number) {
        if (pageNumber < 1 || pageNumber > this.state.maxPageNumber) {
            throw Error('Invalid pageNumber ' + pageNumber + ' requested')
        }

        this.setState({ currentPageNumber: pageNumber })
    }

    /**
     * Setter method for number of tuples per page
     * @param numberOfTuplesPerPage number of tuples per page to view
     */
    setNumberOfTuplesPerPage(numberOfTuplesPerPage: number) {
        if (numberOfTuplesPerPage < 0) {
            throw Error('Number of Tuples per page cannnot be less then 0')
        }
        this.setState({ numberOfTuplesPerPage: numberOfTuplesPerPage })
    }

    /**
     * Setter for valid restrictions to apply during table fetching
     * @param restrictions Array of vaild Restrictions
     */
    setRestrictions(restrictions: Array<Restriction>) {
        this.setState({ restrictions: restrictions })
    }

    setOrders(newOrder: string) {
        var orderDelete = false
        var newOrderList = []
        for (let order of this.state.orders.reverse()) {
            //if the attribute name matches one in the order array, overwrite it.
            if (newOrder.split(' ')[0] === order.split(' ')[0]) {
                if (newOrder.split(' ')[1] === 'del') {
                    orderDelete = true
                    continue
                }
                continue
            }
            newOrderList.unshift(order)
        }
        if (orderDelete === false) {
            newOrderList.unshift(newOrder)
            this.setState({ orders: newOrderList })
        }
        this.setState({ orders: newOrderList })
    }

    /**
     * Switch current view given to viewChoice
     * @param viewChoice
     */
    switchCurrentView(viewChoice: CurrentView) {
        this.setState({ currentView: viewChoice })
    }

    /**
     * Handle updating views based on the possiable following changes
     * - selectedTableName changes => Fetch current view and set the other to need update
     * - currentView changes => Fetch if data refresh is needed, if not just switch
     * - currentPageNumber changes => Refetch the tuples with the given page and current set of restrictions
     * - restrictions changes => Refetch tuples with updated restrictions
     * @param prevProps
     * @param prevState
     */
    componentDidUpdate(prevProps: TableViewProps, prevState: TableViewState) {
        if (this.state.currentView !== prevState.currentView) {
            // The view change thus update accordingly if refresh is needed
            if (
                this.state.currentView === CurrentView.TABLE_CONTENT &&
                this.state.tableContentNeedRefresh
            ) {
                // Fetch data realted to TableContent
                this.fetchTableAttributeAndContent()
                this.setState({ tableContentNeedRefresh: false })
            }
        } else if (this.state.currentPageNumber !== prevState.currentPageNumber) {
            this.fetchTableContent()
        } else if (this.state.numberOfTuplesPerPage !== prevState.numberOfTuplesPerPage) {
            clearTimeout(this.state.setNumberOFTuplesPerPageTimeout)
            const setNumberOFTuplesPerPageTimeout = setTimeout(() => {
                this.fetchTableContent()
                this.setState({ currentPageNumber: 1 })
            }, NUMBER_OF_TUPLES_PER_PAGE_TIMEOUT)
            this.setState({
                setNumberOFTuplesPerPageTimeout: setNumberOFTuplesPerPageTimeout
            })
        } else if (this.state.restrictions !== prevState.restrictions) {
            this.fetchTableContent()
        } else if (this.state.orders !== prevState.orders) {
            this.fetchTableContent()
        }
    }

    /**
     * Combination method for fetching table attribute and content. Typically use when the selected table changes
     */
    async fetchTableAttributeAndContent() {
        this.setState({ isLoading: true })
        // retrieve table headers
        await this.fetchTableAttribute()
        await this.fetchTableContent()

        return 1
    }

    /**
     * Function to query the back end to get infomation about the table attributes
     */
    fetchTableAttribute() {
        let apiUrl =
            `${process.env.REACT_APP_DJSCIVIZ_BACKEND_PREFIX}` +
            this.props.route +
            '/attributes'

        if (this.props.databaseHost) {
            apiUrl = apiUrl.concat(`&database_host=${this.props.databaseHost}`)
        }

        fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + this.props.token
            }
        })
            .then((result) => {
                if (!result.ok) {
                    result
                        .text()
                        .then((errorMessage) => {
                            throw Error(
                                `${result.status} - ${result.statusText}: (${errorMessage})`
                            )
                        })
                        .catch((error) => {
                            this.setState({
                                tableAttributesInfo: undefined,
                                errorMessage: 'Problem fetching table attributes: ' + error,
                                isLoading: false
                            })
                        })
                }
                return result.json()
            })
            .then((result) => {
                this.setState({
                    tableAttributesInfo: this.parseTableAttributes(result),
                    errorMessage: ''
                })
            })
    }

    /**
     * Utility function for refeshing the table view of tuples with the given restriction set via this.state.restrictions
     */
    fetchTableContent() {
        // Buffer to store restrictions
        let urlParams: Array<string> = []

        // Add limit to url
        urlParams.push('limit=' + this.state.numberOfTuplesPerPage)

        // Add page param
        urlParams.push('page=' + this.state.currentPageNumber)

        if (this.state.restrictions.length !== 0) {
            let restrictionsInAPIFormat = []
            for (let restriction of this.state.restrictions) {
                if (
                    restriction.tableAttribute?.attributeType === TableAttributeType.DATETIME
                ) {
                    restrictionsInAPIFormat.push({
                        attributeName: restriction.tableAttribute?.attributeName,
                        operation: Restriction.getRestrictionTypeString(
                            restriction.restrictionType
                        ),
                        value: restriction.value[0] + ' ' + restriction.value[1]
                    })
                } else {
                    restrictionsInAPIFormat.push({
                        attributeName: restriction.tableAttribute?.attributeName,
                        operation: Restriction.getRestrictionTypeString(
                            restriction.restrictionType
                        ),
                        value: restriction.value
                    })
                }
            }

            // Covert the restrictions to json string then base64 it
            urlParams.push(
                'restriction=' +
                    encodeURIComponent(btoa(JSON.stringify(restrictionsInAPIFormat)))
            )
        }

        if (this.state.orders.length !== 0) {
            urlParams.push('order=' + this.state.orders)
        }

        // Build the url with params
        let apiUrl = `${process.env.REACT_APP_DJSCIVIZ_BACKEND_PREFIX}` + this.props.route
        if (urlParams.length > 0) {
            apiUrl += '?'

            // Add the first param
            apiUrl += urlParams[0]

            for (let i = 1; i < urlParams.length; i++) {
                apiUrl += '&' + urlParams[i]
            }
        }
        if (this.props.databaseHost) {
            apiUrl = apiUrl.concat(`&database_host=${this.props.databaseHost}`)
        }
        // Call get fetch_tuple with params
        fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + this.props.token
            }
        })
            .then((result) => {
                if (!result.ok) {
                    result
                        .text()
                        .then((errorMessage) => {
                            throw Error(
                                `${result.status} - ${result.statusText}: (${errorMessage})`
                            )
                        })
                        .catch((error) => {
                            this.setState({
                                tableContentData: [],
                                errorMessage: 'Problem fetching table content: ' + error,
                                isLoading: false
                            })
                        })
                }
                return result.json()
            })
            .then((result) => {
                // Deal with coverting time back to datajoint format
                let tableAttributes: Array<TableAttribute> = this.state.tableAttributesInfo
                    ?.primaryAttributes as Array<TableAttribute>
                tableAttributes = tableAttributes.concat(
                    this.state.tableAttributesInfo
                        ?.secondaryAttributes as Array<TableAttribute>
                )

                // Iterate though each tableAttribute and deal with TEMPORAL types
                for (let i = 0; i < tableAttributes.length; i++) {
                    if (tableAttributes[i].attributeType === TableAttributeType.TIME) {
                        for (let tuple of result.records) {
                            tuple[i] = TableAttribute.parseTimeString(tuple[i])
                        }
                    } else if (
                        tableAttributes[i].attributeType === TableAttributeType.TIMESTAMP ||
                        tableAttributes[i].attributeType === TableAttributeType.DATETIME
                    ) {
                        for (let tuple of result.records) {
                            tuple[i] = TableAttribute.parseDateTime(tuple[i])
                        }
                    } else if (tableAttributes[i].attributeType === TableAttributeType.DATE) {
                        for (let tuple of result.records) {
                            tuple[i] = TableAttribute.parseDate(tuple[i])
                        }
                    }
                }

                this.setState({
                    tableContentData: result.records,
                    totalNumOfTuples: result.totalCount,
                    errorMessage: '',
                    maxPageNumber: Math.ceil(
                        result.totalCount / this.state.numberOfTuplesPerPage
                    ),
                    isLoading: false
                })
            })
            .catch((error) => {
                this.setState({
                    tableContentData: [],
                    errorMessage: 'Problem fetching table content: ' + error,
                    isLoading: false
                })
            })
    }

    /**
     * Function to convert the api return json to produce a TableAttributeInfo
     * @param jsonResult
     */
    parseTableAttributes(jsonResult: any): TableAttributesInfo {
        // Create object for the return
        let tableAttributesInfo = new TableAttributesInfo([], [])

        // Deal with primary attributes
        for (let primaryAttributeInfoArray of jsonResult.attributes.primary) {
            let tableAttributeType: TableAttributeType = this.parseTableTypeString(
                primaryAttributeInfoArray[1]
            )

            // If the datatype is of type VarChar or Char record the limit or range of it
            if (tableAttributeType === TableAttributeType.VAR_CHAR) {
                tableAttributesInfo.primaryAttributes.push(
                    new PrimaryTableAttribute(
                        primaryAttributeInfoArray[0],
                        tableAttributeType,
                        primaryAttributeInfoArray[4],
                        parseInt(
                            primaryAttributeInfoArray[1].substring(
                                8,
                                primaryAttributeInfoArray[1].length - 1
                            )
                        )
                    )
                )
            } else if (tableAttributeType === TableAttributeType.CHAR) {
                tableAttributesInfo.primaryAttributes.push(
                    new PrimaryTableAttribute(
                        primaryAttributeInfoArray[0],
                        tableAttributeType,
                        primaryAttributeInfoArray[4],
                        parseInt(
                            primaryAttributeInfoArray[1].substring(
                                5,
                                primaryAttributeInfoArray[1].length - 1
                            )
                        )
                    )
                )
            } else if (tableAttributeType === TableAttributeType.ENUM) {
                tableAttributesInfo.primaryAttributes.push(
                    new PrimaryTableAttribute(
                        primaryAttributeInfoArray[0],
                        tableAttributeType,
                        primaryAttributeInfoArray[4],
                        undefined,
                        primaryAttributeInfoArray[1]
                            .substring(5, primaryAttributeInfoArray[1].length - 1)
                            .replace(/'/g, '')
                            .split(',')
                    )
                )
            } else if (tableAttributeType === TableAttributeType.DECIMAL) {
                let decimalAttributes = primaryAttributeInfoArray[1]
                    .substring(7)
                    .replace(/[{()}]/g, '')
                    .split(',')

                tableAttributesInfo.primaryAttributes.push(
                    new PrimaryTableAttribute(
                        primaryAttributeInfoArray[0],
                        tableAttributeType,
                        primaryAttributeInfoArray[4],
                        undefined,
                        undefined,
                        parseInt(decimalAttributes[0]),
                        parseInt(decimalAttributes[1])
                    )
                )
            } else {
                tableAttributesInfo.primaryAttributes.push(
                    new PrimaryTableAttribute(
                        primaryAttributeInfoArray[0],
                        tableAttributeType,
                        primaryAttributeInfoArray[4]
                    )
                )
            }
        }

        // Deal with secondary attributes
        for (let secondaryAttributesInfoArray of jsonResult.attributes.secondary) {
            let tableAttributeType: TableAttributeType = this.parseTableTypeString(
                secondaryAttributesInfoArray[1]
            )

            // If the datatype is of type VarChar or Char record the limit or range of it
            if (tableAttributeType === TableAttributeType.VAR_CHAR) {
                tableAttributesInfo.secondaryAttributes.push(
                    new SecondaryTableAttribute(
                        secondaryAttributesInfoArray[0],
                        this.parseTableTypeString(secondaryAttributesInfoArray[1]),
                        secondaryAttributesInfoArray[2],
                        secondaryAttributesInfoArray[3],
                        parseInt(
                            secondaryAttributesInfoArray[1].substring(
                                8,
                                secondaryAttributesInfoArray[1].length - 1
                            )
                        )
                    )
                )
            } else if (tableAttributeType === TableAttributeType.CHAR) {
                tableAttributesInfo.secondaryAttributes.push(
                    new SecondaryTableAttribute(
                        secondaryAttributesInfoArray[0],
                        this.parseTableTypeString(secondaryAttributesInfoArray[1]),
                        secondaryAttributesInfoArray[2],
                        secondaryAttributesInfoArray[3],
                        parseInt(
                            secondaryAttributesInfoArray[1].substring(
                                5,
                                secondaryAttributesInfoArray[1].length - 1
                            )
                        )
                    )
                )
            } else if (tableAttributeType === TableAttributeType.ENUM) {
                // Get each enum option and save it under enumOptions
                tableAttributesInfo.secondaryAttributes.push(
                    new SecondaryTableAttribute(
                        secondaryAttributesInfoArray[0],
                        this.parseTableTypeString(secondaryAttributesInfoArray[1]),
                        secondaryAttributesInfoArray[2],
                        secondaryAttributesInfoArray[3],
                        undefined,
                        secondaryAttributesInfoArray[1]
                            .substring(5, secondaryAttributesInfoArray[1].length - 1)
                            .replace(/'/g, '')
                            .split(',')
                    )
                )
            } else if (tableAttributeType === TableAttributeType.DECIMAL) {
                let decimalAttributes = secondaryAttributesInfoArray[1]
                    .substring(7)
                    .replace(/[{()}]/g, '')
                    .split(',')
                // Get each enum option and save it under enumOptions
                tableAttributesInfo.secondaryAttributes.push(
                    new SecondaryTableAttribute(
                        secondaryAttributesInfoArray[0],
                        this.parseTableTypeString(secondaryAttributesInfoArray[1]),
                        secondaryAttributesInfoArray[2],
                        secondaryAttributesInfoArray[3],
                        undefined,
                        undefined,
                        parseInt(decimalAttributes[0]),
                        parseInt(decimalAttributes[1])
                    )
                )
            } else {
                tableAttributesInfo.secondaryAttributes.push(
                    new SecondaryTableAttribute(
                        secondaryAttributesInfoArray[0],
                        this.parseTableTypeString(secondaryAttributesInfoArray[1]),
                        secondaryAttributesInfoArray[2],
                        secondaryAttributesInfoArray[3]
                    )
                )
            }
        }
        return tableAttributesInfo
    }

    /**
     * Function to deal figure out what is the datatype given a string
     * @param tableTypeString The table type in string that was return from the api call
     */
    parseTableTypeString(tableTypeString: string): TableAttributeType {
        if (tableTypeString === 'tinyint') {
            return TableAttributeType.TINY
        } else if (tableTypeString === 'tinyint unsigned') {
            return TableAttributeType.TINY_UNSIGNED
        } else if (tableTypeString === 'smallint') {
            return TableAttributeType.SMALL
        } else if (tableTypeString === 'smallint unsigned') {
            return TableAttributeType.SMALL_UNSIGNED
        } else if (tableTypeString === 'medium') {
            return TableAttributeType.MEDIUM
        } else if (tableTypeString === 'medium unsigned') {
            return TableAttributeType.MEDIUM_UNSIGNED
        } else if (tableTypeString === 'big') {
            return TableAttributeType.BIG_UNSIGNED
        } else if (tableTypeString === 'big unsigned') {
            return TableAttributeType.BIG_UNSIGNED
        } else if (tableTypeString === 'int') {
            return TableAttributeType.INT
        } else if (
            tableTypeString === 'int unsigned' ||
            tableTypeString === 'bigint unsigned'
        ) {
            return TableAttributeType.INT_UNSIGNED
        } else if (tableTypeString.substr(0, 7) === 'decimal') {
            return TableAttributeType.DECIMAL
        } else if (tableTypeString === 'decimal unsigned') {
            // Depricated in SQL 8.0
            return TableAttributeType.DECIMAL_UNSIGNED
        } else if (tableTypeString === 'float') {
            return TableAttributeType.FLOAT
        } else if (tableTypeString === 'float unsigned') {
            return TableAttributeType.FLOAT_UNSIGNED
        } else if (tableTypeString === 'double') {
            return TableAttributeType.DOUBLE
        } else if (tableTypeString === 'bool') {
            return TableAttributeType.BOOL
        } else if (tableTypeString.substring(0, 4) === 'char') {
            return TableAttributeType.CHAR
        } else if (tableTypeString.substring(0, 7) === 'varchar') {
            return TableAttributeType.VAR_CHAR
        } else if (tableTypeString === 'uuid') {
            return TableAttributeType.UUID
        } else if (tableTypeString === 'date') {
            return TableAttributeType.DATE
        } else if (tableTypeString.includes('datetime')) {
            return TableAttributeType.DATETIME
        } else if (tableTypeString === 'time') {
            return TableAttributeType.TIME
        } else if (tableTypeString === 'timestamp') {
            return TableAttributeType.TIMESTAMP
        } else if (tableTypeString.substring(0, 4) === 'enum') {
            return TableAttributeType.ENUM
        } else if (
            tableTypeString === 'blob' ||
            tableTypeString === 'longblob' ||
            tableTypeString === 'mediumblob'
        ) {
            return TableAttributeType.BLOB
        } else if (tableTypeString === 'expression') {
            return TableAttributeType.EXPRESSION
        } else if (tableTypeString.includes('datetime(')) return TableAttributeType.DATETIMESTR

        throw Error(
            'Unsupported TableAttributeType: ' +
                tableTypeString +
                ' of type ' +
                tableTypeString
        )
    }

    render() {
        return (
            <Card
                className='table-view'
                bodyStyle={{ overflow: 'auto', height: '100%' }}
                hoverable={true}
            >
                <TableContent
                    token={this.props.token}
                    selectedTableName={this.props.tableName}
                    contentData={this.state.tableContentData}
                    currentPageNumber={this.state.currentPageNumber}
                    maxPageNumber={this.state.maxPageNumber}
                    totalNumOfTuples={this.state.totalNumOfTuples}
                    tuplePerPage={this.state.numberOfTuplesPerPage}
                    tableAttributesInfo={this.state.tableAttributesInfo}
                    link={this.props.link}
                    setPageNumber={this.setPageNumber}
                    setNumberOfTuplesPerPage={this.setNumberOfTuplesPerPage}
                    fetchTableContent={this.fetchTableContent}
                    setRestrictions={this.setRestrictions}
                    setOrders={this.setOrders}
                    updateRestrictionList={this.props.updateRestrictionList}
                    updatePageStore={this.props.updatePageStore}
                    channel={this.props.channel}
                />
            </Card>
        )
    }
}
